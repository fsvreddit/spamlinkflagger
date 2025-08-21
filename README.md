This Dev Platform app flags comments via reports when:

* A user makes a comments on an old post that include a URL
* A user edits a comment that didn't originally include a URL, to include one within 28 days of the comment being created

By default, an "old post" is one that is 30 days or older, but this setting can be configured as you wish. You can also configure a "grace period" (default 5 minutes) where a user editing a comment to include a link will not result in it being flagged.

Only comments made since the app was installed will be checked on edit. This is because the app needs to check the original body text, and this is only stored once the app is installed.

Comments over 28 days old will not be checked on edit. This is to reduce the data retention requirements of the app.

## Change History

v1.0.0

* Initial public release
