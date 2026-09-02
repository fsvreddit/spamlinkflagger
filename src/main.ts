import { Devvit } from "@devvit/public-api";
import { appSettings } from "./settings.js";
import { handleCommentCreate, handleCommentEdit, reportComment } from "./commentHandling.js";
import { handleAutomodFilterComment, handleModAction } from "./automodTracker.js";
import { SchedulerJob } from "./constants.js";

Devvit.addSettings(appSettings);

Devvit.addTrigger({
    event: "CommentCreate",
    onEvent: handleCommentCreate,
});

Devvit.addTrigger({
    event: "CommentUpdate",
    onEvent: handleCommentEdit,
});

Devvit.addTrigger({
    event: "ModAction",
    onEvent: handleModAction,
});

Devvit.addTrigger({
    event: "AutomoderatorFilterComment",
    onEvent: handleAutomodFilterComment,
});

Devvit.addSchedulerJob({
    name: SchedulerJob.ReportComment,
    onRun: reportComment,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
