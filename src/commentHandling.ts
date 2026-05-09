import { TriggerContext } from "@devvit/public-api";
import { CommentCreate, CommentUpdate } from "@devvit/protos";
import { DateTime } from "luxon";
import { AppSetting } from "./settings.js";
import pluralize from "pluralize";
import { isModerator } from "devvit-helpers";
import { hasTriggerBeenHandled } from "@fsvreddit/fsv-devvit-helpers";

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

    if (!commentContainsALink(event.comment.body)) {
        return;
    }

    if (await hasTriggerBeenHandled(context.redis, `commentCreate:${event.comment.id}`)) {
        return;
    }

    const settings = await context.settings.getAll();
    if (!settings[AppSetting.FlagCommentsOnOldPosts]) {
        return;
    }

    const oldPostTimeframe = settings[AppSetting.FlagCommentsOnOldPostsTimeframe] as number | undefined ?? 30;

    // Comment contains a link. Check post date.
    const postCreationDate = new Date(event.post.createdAt);
    if (postCreationDate > DateTime.now().minus({ days: oldPostTimeframe }).toJSDate()) {
        // Post is not old enough to flag
        return;
    }

    const comment = await context.reddit.getCommentById(event.comment.id);

    if (await userIsModerator(comment.authorName, context)) {
        return;
    }

    await context.reddit.report(comment, { reason: `Comment with a link on a post over ${oldPostTimeframe} ${pluralize("day", oldPostTimeframe)} old` });
    console.log(`Reported comment ${event.comment.id} for containing a link on an old post`);
}

export async function handleCommentEdit (event: CommentUpdate, context: TriggerContext) {
    const { id, body } = event.comment ?? {};

    if (!id || body === undefined) {
        console.error("Event is missing expected comment ID or body property");
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

    if (await hasTriggerBeenHandled(context.redis, `commentEdit:${id}`, { expiration: DateTime.now().plus({ seconds: 30 }).toJSDate() })) {
        return;
    }

    // Comment has been edited to include a URL when none was present previously. Report the comment.
    const comment = await context.reddit.getCommentById(id);

    const ignoreEditsWithinTimeframe = settings[AppSetting.IgnoreEditsWithinTimeframe] as number | undefined ?? 5;
    const createdAt = DateTime.fromJSDate(comment.createdAt);
    if (createdAt > DateTime.now().minus({ minutes: ignoreEditsWithinTimeframe })) {
        return;
    }

    if (await userIsModerator(comment.authorName, context)) {
        return;
    }

    await context.reddit.report(comment, { reason: "Comment edited to include a link" });
    console.log(`Reported comment ${id} for editing to include a link`);
}
