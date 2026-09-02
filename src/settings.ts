import { SettingsFormField } from "@devvit/public-api";

export enum AppSetting {
    FlagCommentsWithLinksOnOldPosts = "flagCommentsOnOldPosts", // This string shouldn't change as it will break existing config
    FlagAnyCommentsOnOldPosts = "flagAnyCommentsOnOldPosts",
    FlagCommentsOnOldPostsTimeframe = "flagCommentsOnOldPostsTimeframe",
    FlagCommentEdits = "flagCommentEdits",
    IgnoreEditsWithinTimeframe = "ignoreEditsWithinTimeframe",
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
function validatePositiveInteger (input: number | undefined, minimum: number): string | void {
    if (input === undefined) {
        return;
    }

    if (input < minimum) {
        return `Value must be at least ${minimum}`;
    }

    if (!Number.isInteger(input)) {
        return "Value must be a whole number";
    }
}

export const appSettings: SettingsFormField[] = [
    {
        type: "boolean",
        name: AppSetting.FlagCommentsWithLinksOnOldPosts,
        label: "Report comments that contain a link if they are made on old posts",
        defaultValue: true,
    },
    {
        type: "boolean",
        name: AppSetting.FlagAnyCommentsOnOldPosts,
        label: "Report any comments if they are made on old posts, even without a link",
        defaultValue: false,
    },
    {
        type: "number",
        name: AppSetting.FlagCommentsOnOldPostsTimeframe,
        label: "Number of days before a post is considered 'old'",
        defaultValue: 30,
        onValidate: ({ value }) => validatePositiveInteger(value, 1),
    },
    {
        type: "boolean",
        name: AppSetting.FlagCommentEdits,
        label: "Report comments that have been edited to include a link",
        defaultValue: true,
    },
    {
        type: "number",
        name: AppSetting.IgnoreEditsWithinTimeframe,
        label: "Ignore edits made within this many minutes of the comment being created",
        defaultValue: 5,
        onValidate: ({ value }) => validatePositiveInteger(value, 0),
    },
];
