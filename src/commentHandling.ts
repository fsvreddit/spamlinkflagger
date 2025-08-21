import { TriggerContext } from "@devvit/public-api";
import { CommentCreate, CommentDelete, CommentUpdate } from "@devvit/protos";
import { DateTime } from "luxon";
import { AppSetting } from "./settings.js";
import pluralize from "pluralize";

export function commentContainsALink (comment: string) {
    const urlRegexes = [
        /https?:\/\/\S+/,
        /www(?:\.[A-Za-z0-9_-]+)+\/\S+\b/,
    ];

    return urlRegexes.some(regex => regex.test(comment));
}

function getCommentKey (commentId: string) {
    return `comment:${commentId}`;
}

export async function handleCommentCreate (event: CommentCreate, context: TriggerContext) {
    const { id, body, postId } = event.comment ?? {};

    if (!id || body === undefined || !postId) {
        console.error("Event is missing expected comment ID, body, or post ID property");
        return;
    }

    await context.redis.set(getCommentKey(id), body, { expiration: DateTime.now().plus({ days: 28 }).toJSDate() });

    if (!commentContainsALink(body)) {
        return;
    }

    const settings = await context.settings.getAll();
    if (!settings[AppSetting.FlagCommentsOnOldPosts]) {
        return;
    }

    const oldPostTimeframe = settings[AppSetting.FlagCommentsOnOldPostsTimeframe] as number | undefined ?? 30;

    // Comment contains a link. Check post date.
    const post = await context.reddit.getPostById(postId);
    if (post.createdAt > DateTime.now().minus({ days: oldPostTimeframe }).toJSDate()) {
        // Post is not old enough to flag
        return;
    }

    const comment = await context.reddit.getCommentById(id);
    await context.reddit.report(comment, { reason: `Comment with a link on a post over ${oldPostTimeframe} ${pluralize("day", oldPostTimeframe)} old` });
    console.log(`Reported comment ${id} for containing a link on an old post`);
}

export async function handleCommentDelete (event: CommentDelete, context: TriggerContext) {
    await context.redis.del(event.commentId);
}

export async function handleCommentEdit (event: CommentUpdate, context: TriggerContext) {
    const { id, body } = event.comment ?? {};

    if (!id || body === undefined) {
        console.error("Event is missing expected comment ID or body property");
        return;
    }

    if (!commentContainsALink(body)) {
        // Comment does not contain a link, so no need to check for edits. Just store the new body.
        await context.redis.set(id, body, { expiration: DateTime.now().plus({ days: 28 }).toJSDate() });
        return;
    }

    const previousBody = await context.redis.get(getCommentKey(id));
    if (previousBody === undefined) {
        // No previous record of comment body, so cannot assume that it didn't contain a link before.
        return;
    }

    await context.redis.set(id, body, { expiration: DateTime.now().plus({ days: 28 }).toJSDate() });

    if (commentContainsALink(previousBody)) {
        // Comment previously contained a URL, so likely not malicious.
        return;
    }

    const settings = await context.settings.getAll();
    if (!settings[AppSetting.FlagCommentEdits]) {
        return;
    }

    // Comment has been edited to include a URL when none was present previously. Report the comment.
    const comment = await context.reddit.getCommentById(id);

    const ignoreEditsWithinTimeframe = settings[AppSetting.IgnoreEditsWithinTimeframe] as number | undefined ?? 5;
    const createdAt = DateTime.fromJSDate(comment.createdAt);
    if (createdAt > DateTime.now().minus({ minutes: ignoreEditsWithinTimeframe })) {
        return;
    }

    await context.reddit.report(comment, { reason: "Comment edited to include a link" });
    console.log(`Reported comment ${id} for editing to include a link`);
}
