import { JobContext, ScheduledJobEvent, TriggerContext } from "@devvit/public-api";
import { CommentCreate, CommentUpdate } from "@devvit/protos";
import { addSeconds, subDays, subMinutes } from "date-fns";
import { AppSetting } from "./settings.js";
import pluralize from "pluralize";
import { isModerator } from "devvit-helpers";
import { hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-helpers";
import { SchedulerJob } from "./constants.js";
import { getAutomodStatusForComment } from "./automodTracker.js";

type ReportCommentJobData = {
    commentId: string;
    reportText: string;
    jobGuid: string;
};

export function commentContainsALink (comment: string) {
    const urlRegexes = [
        /https?:\/\/\S+/,
        /www(?:\.[A-Za-z0-9_-]+)+\/\S+\b/,
    ];

    return urlRegexes.some(regex => regex.test(comment));
}

async function userIsModerator (username: string, context: TriggerContext) {
    const subredditName = context.subredditName ?? await context.reddit.getCurrentSubredditName();

    if (username === "AutoModerator" || username === `${subredditName}-ModTeam`) {
        return true;
    }

    return await isModerator(context.reddit, subredditName, username);
}

export async function handleCommentCreate (event: CommentCreate, context: TriggerContext) {
    if (!event.comment || !event.post) {
        console.error("Event is missing expected comment or post property");
        return;
    }

    const postCreationDate = new Date(event.post.createdAt);
    // Min allowed setting is 1 day so early exit if post date is under one day, which will be most comments.
    if (postCreationDate > subDays(new Date(), 1)) {
        // Post is not old enough to flag
        return;
    }

    const settings = await context.settings.getAll();
    if (!settings[AppSetting.FlagCommentsWithLinksOnOldPosts] && !settings[AppSetting.FlagAnyCommentsOnOldPosts]) {
        return;
    }

    if (!settings[AppSetting.FlagAnyCommentsOnOldPosts] && !commentContainsALink(event.comment.body)) {
        return;
    }

    const oldPostTimeframe = settings[AppSetting.FlagCommentsOnOldPostsTimeframe] as number | undefined ?? 30;

    if (postCreationDate > subDays(new Date(), oldPostTimeframe)) {
        // Post is not old enough to flag
        return;
    }

    if (await hasTriggerBeenHandled(context.redis, `commentCreate:${event.comment.id}`)) {
        return;
    }

    // Schedule a job on a short delay to report the comment. This is to allow any associated AutoMod actions to process.
    await context.scheduler.runJob<ReportCommentJobData>({
        name: SchedulerJob.ReportComment,
        data: {
            commentId: event.comment.id,
            reportText: `Comment with a link on a post over ${oldPostTimeframe} ${pluralize("day", oldPostTimeframe)} old`,
            jobGuid: crypto.randomUUID(),
        },
        runAt: addSeconds(new Date(), 10),
    });
}

export async function handleCommentEdit (event: CommentUpdate, context: TriggerContext) {
    const { id, body } = event.comment ?? {};

    if (!id || body === undefined) {
        console.error("Event is missing expected comment ID or body property");
        return;
    }

    if (!commentContainsALink(body)) {
        return;
    }

    if (commentContainsALink(event.previousBody)) {
        // Comment previously contained a URL, so likely not malicious.
        return;
    }

    const settings = await context.settings.getAll();
    if (!settings[AppSetting.FlagCommentEdits]) {
        return;
    }

    if (await hasTriggerBeenHandled(context.redis, `commentEdit:${id}`, { expiration: addSeconds(new Date(), 30) })) {
        return;
    }

    // Comment has been edited to include a URL when none was present previously. Report the comment.
    const comment = await context.reddit.getCommentById(id);

    console.log(`Checking comment ${id} edited by ${comment.authorName}`);

    const ignoreEditsWithinTimeframe = settings[AppSetting.IgnoreEditsWithinTimeframe] as number | undefined ?? 5;
    if (comment.createdAt > subMinutes(new Date(), ignoreEditsWithinTimeframe)) {
        return;
    }

    await context.scheduler.runJob<ReportCommentJobData>({
        name: SchedulerJob.ReportComment,
        data: {
            commentId: id,
            reportText: `Comment edited to include a link`,
            jobGuid: crypto.randomUUID(),
        },
        runAt: addSeconds(new Date(), 10),
    });
}

export async function reportComment (event: ScheduledJobEvent<ReportCommentJobData>, context: JobContext) {
    if (await hasTriggerBeenHandled(context.redis, `reportComment:${event.data.jobGuid}`)) {
        console.warn(`Job ${event.data.jobGuid} has already been handled. Skipping reportComment.`);
        return;
    }

    if (await getAutomodStatusForComment(event.data.commentId, context) === "removed") {
        console.log(`Comment ${event.data.commentId} has already been removed by AutoMod. Skipping reportComment.`);
        return;
    }

    const comment = await context.reddit.getCommentById(event.data.commentId);

    if (comment.spam || comment.removed) {
        console.log(`Comment ${event.data.commentId} has already been removed or marked as spam. Skipping reportComment.`);
        return;
    }

    if (await userIsModerator(comment.authorName, context)) {
        console.log(`Not reporting comment ${event.data.commentId} because author ${comment.authorName} is a moderator`);
        return;
    }

    await context.reddit.report(comment, { reason: event.data.reportText });
    console.log(`Reported comment ${comment.id} for containing a link on an old post`);
}
