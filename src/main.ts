import { Devvit } from "@devvit/public-api";
import { appSettings } from "./settings.js";
import { handleCommentCreate, handleCommentEdit } from "./commentHandling.js";

Devvit.addSettings(appSettings);

Devvit.addTrigger({
    event: "CommentCreate",
    onEvent: handleCommentCreate,
});

Devvit.addTrigger({
    event: "CommentUpdate",
    onEvent: handleCommentEdit,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
