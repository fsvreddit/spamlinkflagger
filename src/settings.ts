import { SettingsFormField } from "@devvit/public-api";

export enum AppSetting {
    FlagCommentsOnOldPosts = "flagCommentsOnOldPosts",
    FlagCommentsOnOldPostsTimeframe = "flagCommentsOnOldPostsTimeframe",
    FlagCommentEdits = "flagCommentEdits",
    IgnoreEditsWithinTimeframe = "ignoreEditsWithinTimeframe",
}

export const appSettings: SettingsFormField[] = [
    {
        type: "boolean",
        name: AppSetting.FlagCommentsOnOldPosts,
        label: "Report comments on old posts that contain a link",
        defaultValue: true,
    },
    {
        type: "number",
        name: AppSetting.FlagCommentsOnOldPostsTimeframe,
        label: "Number of days before a post is considered 'old'",
        defaultValue: 30,
        onValidate: ({ value }) => {
            if (value === undefined) {
                return;
            }

            if (value < 1) {
                return "Value must be at least 1";
            }
        },
    },
    {
        type: "boolean",
        name: AppSetting.FlagCommentEdits,
        label: "Report comments that have been edited to include a link within 28 days of comment creation",
        defaultValue: true,
    },
    {
        type: "number",
        name: AppSetting.IgnoreEditsWithinTimeframe,
        label: "Ignore edits made within this many minutes of the comment being created",
        defaultValue: 5,
        onValidate: ({ value }) => {
            if (value === undefined) {
                return;
            }

            if (value < 0) {
                return "Value must be at least 0";
            }
        },
    },
];
