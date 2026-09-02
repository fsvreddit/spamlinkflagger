import { AutomoderatorFilterComment, ModAction } from "@devvit/protos";
import { TriggerContext } from "@devvit/public-api";
import { addDays } from "date-fns";

function getKeyForCommentId (targetId: string, action: "filter" | "remove") {
    return `automodAction:${targetId}:${action}`;
}

export async function handleModAction (event: ModAction, context: TriggerContext) {
    if (event.action !== "removecomment" && event.action !== "spamcomment") {
        return;
    }

    if (!event.targetComment?.id) {
        return;
    }

    if (event.moderator?.name === "AutoModerator") {
        await context.redis.set(getKeyForCommentId(event.targetComment.id, "remove"), Date.now().toString(), { expiration: addDays(new Date(), 1) });
    } else {
        await context.redis.del(getKeyForCommentId(event.targetComment.id, "remove"), getKeyForCommentId(event.targetComment.id, "filter"));
    }
}

export async function handleAutomodFilterComment (event: AutomoderatorFilterComment, context: TriggerContext) {
    if (!event.comment?.id) {
        return;
    }
    await context.redis.set(getKeyForCommentId(event.comment.id, "filter"), Date.now().toString(), { expiration: addDays(new Date(), 1) });
}

export async function getAutomodStatusForComment (commentId: string, context: TriggerContext): Promise<"filtered" | "removed" | undefined> {
    const [filtered, removed] = await context.redis.mGet([getKeyForCommentId(commentId, "filter"), getKeyForCommentId(commentId, "remove")])
        .then(results => results.map(result => result !== null));

    if (filtered) {
        return "filtered";
    }

    if (removed) {
        return "removed";
    }
}
