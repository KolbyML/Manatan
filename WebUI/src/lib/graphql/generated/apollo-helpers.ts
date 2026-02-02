import {FieldPolicy, FieldReadFunction, Reference, TypePolicies, TypePolicy} from '@apollo/client/cache';
import {
	GetChaptersMangaQuery, GetDownloadStatusQueryVariables, GetGlobalMetadataQueryVariables,
	GetMangaScreenQueryVariables, GetSourceBrowseQueryVariables, GetUpdateStatusQueryVariables,  
} from "@/lib/graphql/generated/graphql.ts";
import {FieldFunctionOptions} from "@apollo/client/cache/inmemory/policies";
export type AboutServerPayloadKeySpecifier = ('buildTime' | 'buildType' | 'discord' | 'github' | 'name' | 'revision' | 'version' | AboutServerPayloadKeySpecifier)[];
export type AboutServerPayloadFieldPolicy = {
	buildTime?: FieldPolicy<any> | FieldReadFunction<any>,
	buildType?: FieldPolicy<any> | FieldReadFunction<any>,
	discord?: FieldPolicy<any> | FieldReadFunction<any>,
	github?: FieldPolicy<any> | FieldReadFunction<any>,
	name?: FieldPolicy<any> | FieldReadFunction<any>,
	revision?: FieldPolicy<any> | FieldReadFunction<any>,
	version?: FieldPolicy<any> | FieldReadFunction<any>
};
export type AboutWebUIKeySpecifier = ('channel' | 'tag' | 'updateTimestamp' | AboutWebUIKeySpecifier)[];
export type AboutWebUIFieldPolicy = {
	channel?: FieldPolicy<any> | FieldReadFunction<any>,
	tag?: FieldPolicy<any> | FieldReadFunction<any>,
	updateTimestamp?: FieldPolicy<any> | FieldReadFunction<any>
};
export type BackupRestoreStatusKeySpecifier = ('mangaProgress' | 'state' | 'totalManga' | BackupRestoreStatusKeySpecifier)[];
export type BackupRestoreStatusFieldPolicy = {
	mangaProgress?: FieldPolicy<any> | FieldReadFunction<any>,
	state?: FieldPolicy<any> | FieldReadFunction<any>,
	totalManga?: FieldPolicy<any> | FieldReadFunction<any>
};
export type BindTrackPayloadKeySpecifier = ('clientMutationId' | 'trackRecord' | BindTrackPayloadKeySpecifier)[];
export type BindTrackPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	trackRecord?: FieldPolicy<any> | FieldReadFunction<any>
};
export type CategoryEdgeKeySpecifier = ('cursor' | 'node' | CategoryEdgeKeySpecifier)[];
export type CategoryEdgeFieldPolicy = {
	cursor?: FieldPolicy<any> | FieldReadFunction<any>,
	node?: FieldPolicy<any> | FieldReadFunction<any>
};
export type CategoryMetaTypeKeySpecifier = ('category' | 'categoryId' | 'key' | 'value' | CategoryMetaTypeKeySpecifier)[];
export type CategoryMetaTypeFieldPolicy = {
	category?: FieldPolicy<any> | FieldReadFunction<any>,
	categoryId?: FieldPolicy<any> | FieldReadFunction<any>,
	key?: FieldPolicy<any> | FieldReadFunction<any>,
	value?: FieldPolicy<any> | FieldReadFunction<any>
};
export type CategoryNodeListKeySpecifier = ('edges' | 'nodes' | 'pageInfo' | 'totalCount' | CategoryNodeListKeySpecifier)[];
export type CategoryNodeListFieldPolicy = {
	edges?: FieldPolicy<any> | FieldReadFunction<any>,
	nodes?: FieldPolicy<any> | FieldReadFunction<any>,
	pageInfo?: FieldPolicy<any> | FieldReadFunction<any>,
	totalCount?: FieldPolicy<any> | FieldReadFunction<any>
};
export type CategoryTypeKeySpecifier = ('default' | 'id' | 'includeInDownload' | 'includeInUpdate' | 'mangas' | 'meta' | 'name' | 'order' | CategoryTypeKeySpecifier)[];
export type CategoryTypeFieldPolicy = {
	default?: FieldPolicy<any> | FieldReadFunction<any>,
	id?: FieldPolicy<any> | FieldReadFunction<any>,
	includeInDownload?: FieldPolicy<any> | FieldReadFunction<any>,
	includeInUpdate?: FieldPolicy<any> | FieldReadFunction<any>,
	mangas?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>,
	name?: FieldPolicy<any> | FieldReadFunction<any>,
	order?: FieldPolicy<any> | FieldReadFunction<any>
};
export type CategoryUpdateTypeKeySpecifier = ('category' | 'status' | CategoryUpdateTypeKeySpecifier)[];
export type CategoryUpdateTypeFieldPolicy = {
	category?: FieldPolicy<any> | FieldReadFunction<any>,
	status?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ChapterEdgeKeySpecifier = ('cursor' | 'node' | ChapterEdgeKeySpecifier)[];
export type ChapterEdgeFieldPolicy = {
	cursor?: FieldPolicy<any> | FieldReadFunction<any>,
	node?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ChapterMetaTypeKeySpecifier = ('chapter' | 'chapterId' | 'key' | 'value' | ChapterMetaTypeKeySpecifier)[];
export type ChapterMetaTypeFieldPolicy = {
	chapter?: FieldPolicy<any> | FieldReadFunction<any>,
	chapterId?: FieldPolicy<any> | FieldReadFunction<any>,
	key?: FieldPolicy<any> | FieldReadFunction<any>,
	value?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ChapterNodeListKeySpecifier = ('edges' | 'nodes' | 'pageInfo' | 'totalCount' | ChapterNodeListKeySpecifier)[];
export type ChapterNodeListFieldPolicy = {
	edges?: FieldPolicy<any> | FieldReadFunction<any>,
	nodes?: FieldPolicy<any> | FieldReadFunction<any>,
	pageInfo?: FieldPolicy<any> | FieldReadFunction<any>,
	totalCount?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ChapterTypeKeySpecifier = ('chapterNumber' | 'fetchedAt' | 'id' | 'isBookmarked' | 'isDownloaded' | 'isRead' | 'lastPageRead' | 'lastReadAt' | 'manga' | 'mangaId' | 'meta' | 'name' | 'pageCount' | 'realUrl' | 'scanlator' | 'sourceOrder' | 'uploadDate' | 'url' | ChapterTypeKeySpecifier)[];
export type ChapterTypeFieldPolicy = {
	chapterNumber?: FieldPolicy<any> | FieldReadFunction<any>,
	fetchedAt?: FieldPolicy<any> | FieldReadFunction<any>,
	id?: FieldPolicy<any> | FieldReadFunction<any>,
	isBookmarked?: FieldPolicy<any> | FieldReadFunction<any>,
	isDownloaded?: FieldPolicy<any> | FieldReadFunction<any>,
	isRead?: FieldPolicy<any> | FieldReadFunction<any>,
	lastPageRead?: FieldPolicy<any> | FieldReadFunction<any>,
	lastReadAt?: FieldPolicy<any> | FieldReadFunction<any>,
	manga?: FieldPolicy<any> | FieldReadFunction<any>,
	mangaId?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>,
	name?: FieldPolicy<any> | FieldReadFunction<any>,
	pageCount?: FieldPolicy<any> | FieldReadFunction<any>,
	realUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	scanlator?: FieldPolicy<any> | FieldReadFunction<any>,
	sourceOrder?: FieldPolicy<any> | FieldReadFunction<any>,
	uploadDate?: FieldPolicy<any> | FieldReadFunction<any>,
	url?: FieldPolicy<any> | FieldReadFunction<any>
};
export type CheckBoxFilterKeySpecifier = ('default' | 'name' | CheckBoxFilterKeySpecifier)[];
export type CheckBoxFilterFieldPolicy = {
	default?: FieldPolicy<any> | FieldReadFunction<any>,
	name?: FieldPolicy<any> | FieldReadFunction<any>
};
export type CheckBoxPreferenceKeySpecifier = ('currentValue' | 'default' | 'enabled' | 'key' | 'summary' | 'title' | 'visible' | CheckBoxPreferenceKeySpecifier)[];
export type CheckBoxPreferenceFieldPolicy = {
	currentValue?: FieldPolicy<any> | FieldReadFunction<any>,
	default?: FieldPolicy<any> | FieldReadFunction<any>,
	enabled?: FieldPolicy<any> | FieldReadFunction<any>,
	key?: FieldPolicy<any> | FieldReadFunction<any>,
	summary?: FieldPolicy<any> | FieldReadFunction<any>,
	title?: FieldPolicy<any> | FieldReadFunction<any>,
	visible?: FieldPolicy<any> | FieldReadFunction<any>
};
export type CheckForServerUpdatesPayloadKeySpecifier = ('channel' | 'tag' | 'url' | CheckForServerUpdatesPayloadKeySpecifier)[];
export type CheckForServerUpdatesPayloadFieldPolicy = {
	channel?: FieldPolicy<any> | FieldReadFunction<any>,
	tag?: FieldPolicy<any> | FieldReadFunction<any>,
	url?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ClearCachedImagesPayloadKeySpecifier = ('cachedPages' | 'cachedThumbnails' | 'clientMutationId' | 'downloadedThumbnails' | ClearCachedImagesPayloadKeySpecifier)[];
export type ClearCachedImagesPayloadFieldPolicy = {
	cachedPages?: FieldPolicy<any> | FieldReadFunction<any>,
	cachedThumbnails?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadedThumbnails?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ClearDownloaderPayloadKeySpecifier = ('clientMutationId' | 'downloadStatus' | ClearDownloaderPayloadKeySpecifier)[];
export type ClearDownloaderPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadStatus?: FieldPolicy<any> | FieldReadFunction<any>
};
export type CreateBackupPayloadKeySpecifier = ('clientMutationId' | 'url' | CreateBackupPayloadKeySpecifier)[];
export type CreateBackupPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	url?: FieldPolicy<any> | FieldReadFunction<any>
};
export type CreateCategoryPayloadKeySpecifier = ('category' | 'clientMutationId' | CreateCategoryPayloadKeySpecifier)[];
export type CreateCategoryPayloadFieldPolicy = {
	category?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DeleteCategoryMetaPayloadKeySpecifier = ('category' | 'clientMutationId' | 'meta' | DeleteCategoryMetaPayloadKeySpecifier)[];
export type DeleteCategoryMetaPayloadFieldPolicy = {
	category?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DeleteCategoryPayloadKeySpecifier = ('category' | 'clientMutationId' | 'mangas' | DeleteCategoryPayloadKeySpecifier)[];
export type DeleteCategoryPayloadFieldPolicy = {
	category?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	mangas?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DeleteChapterMetaPayloadKeySpecifier = ('chapter' | 'clientMutationId' | 'meta' | DeleteChapterMetaPayloadKeySpecifier)[];
export type DeleteChapterMetaPayloadFieldPolicy = {
	chapter?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DeleteDownloadedChapterPayloadKeySpecifier = ('chapters' | 'clientMutationId' | DeleteDownloadedChapterPayloadKeySpecifier)[];
export type DeleteDownloadedChapterPayloadFieldPolicy = {
	chapters?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DeleteDownloadedChaptersPayloadKeySpecifier = ('chapters' | 'clientMutationId' | DeleteDownloadedChaptersPayloadKeySpecifier)[];
export type DeleteDownloadedChaptersPayloadFieldPolicy = {
	chapters?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DeleteGlobalMetaPayloadKeySpecifier = ('clientMutationId' | 'meta' | DeleteGlobalMetaPayloadKeySpecifier)[];
export type DeleteGlobalMetaPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DeleteMangaMetaPayloadKeySpecifier = ('clientMutationId' | 'manga' | 'meta' | DeleteMangaMetaPayloadKeySpecifier)[];
export type DeleteMangaMetaPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	manga?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DeleteSourceMetaPayloadKeySpecifier = ('clientMutationId' | 'meta' | 'source' | DeleteSourceMetaPayloadKeySpecifier)[];
export type DeleteSourceMetaPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>,
	source?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DequeueChapterDownloadPayloadKeySpecifier = ('clientMutationId' | 'downloadStatus' | DequeueChapterDownloadPayloadKeySpecifier)[];
export type DequeueChapterDownloadPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadStatus?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DequeueChapterDownloadsPayloadKeySpecifier = ('clientMutationId' | 'downloadStatus' | DequeueChapterDownloadsPayloadKeySpecifier)[];
export type DequeueChapterDownloadsPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadStatus?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DownloadEdgeKeySpecifier = ('cursor' | 'node' | DownloadEdgeKeySpecifier)[];
export type DownloadEdgeFieldPolicy = {
	cursor?: FieldPolicy<any> | FieldReadFunction<any>,
	node?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DownloadNodeListKeySpecifier = ('edges' | 'nodes' | 'pageInfo' | 'totalCount' | DownloadNodeListKeySpecifier)[];
export type DownloadNodeListFieldPolicy = {
	edges?: FieldPolicy<any> | FieldReadFunction<any>,
	nodes?: FieldPolicy<any> | FieldReadFunction<any>,
	pageInfo?: FieldPolicy<any> | FieldReadFunction<any>,
	totalCount?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DownloadStatusKeySpecifier = ('queue' | 'state' | DownloadStatusKeySpecifier)[];
export type DownloadStatusFieldPolicy = {
	queue?: FieldPolicy<any> | FieldReadFunction<any>,
	state?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DownloadTypeKeySpecifier = ('chapter' | 'manga' | 'position' | 'progress' | 'state' | 'tries' | DownloadTypeKeySpecifier)[];
export type DownloadTypeFieldPolicy = {
	chapter?: FieldPolicy<any> | FieldReadFunction<any>,
	manga?: FieldPolicy<any> | FieldReadFunction<any>,
	position?: FieldPolicy<any> | FieldReadFunction<any>,
	progress?: FieldPolicy<any> | FieldReadFunction<any>,
	state?: FieldPolicy<any> | FieldReadFunction<any>,
	tries?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DownloadUpdateKeySpecifier = ('download' | 'type' | DownloadUpdateKeySpecifier)[];
export type DownloadUpdateFieldPolicy = {
	download?: FieldPolicy<any> | FieldReadFunction<any>,
	type?: FieldPolicy<any> | FieldReadFunction<any>
};
export type DownloadUpdatesKeySpecifier = ('initial' | 'omittedUpdates' | 'state' | 'updates' | DownloadUpdatesKeySpecifier)[];
export type DownloadUpdatesFieldPolicy = {
	initial?: FieldPolicy<any> | FieldReadFunction<any>,
	omittedUpdates?: FieldPolicy<any> | FieldReadFunction<any>,
	state?: FieldPolicy<any> | FieldReadFunction<any>,
	updates?: FieldPolicy<any> | FieldReadFunction<any>
};
export type EdgeKeySpecifier = ('cursor' | 'node' | EdgeKeySpecifier)[];
export type EdgeFieldPolicy = {
	cursor?: FieldPolicy<any> | FieldReadFunction<any>,
	node?: FieldPolicy<any> | FieldReadFunction<any>
};
export type EditTextPreferenceKeySpecifier = ('currentValue' | 'default' | 'dialogMessage' | 'dialogTitle' | 'enabled' | 'key' | 'summary' | 'text' | 'title' | 'visible' | EditTextPreferenceKeySpecifier)[];
export type EditTextPreferenceFieldPolicy = {
	currentValue?: FieldPolicy<any> | FieldReadFunction<any>,
	default?: FieldPolicy<any> | FieldReadFunction<any>,
	dialogMessage?: FieldPolicy<any> | FieldReadFunction<any>,
	dialogTitle?: FieldPolicy<any> | FieldReadFunction<any>,
	enabled?: FieldPolicy<any> | FieldReadFunction<any>,
	key?: FieldPolicy<any> | FieldReadFunction<any>,
	summary?: FieldPolicy<any> | FieldReadFunction<any>,
	text?: FieldPolicy<any> | FieldReadFunction<any>,
	title?: FieldPolicy<any> | FieldReadFunction<any>,
	visible?: FieldPolicy<any> | FieldReadFunction<any>
};
export type EnqueueChapterDownloadPayloadKeySpecifier = ('clientMutationId' | 'downloadStatus' | EnqueueChapterDownloadPayloadKeySpecifier)[];
export type EnqueueChapterDownloadPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadStatus?: FieldPolicy<any> | FieldReadFunction<any>
};
export type EnqueueChapterDownloadsPayloadKeySpecifier = ('clientMutationId' | 'downloadStatus' | EnqueueChapterDownloadsPayloadKeySpecifier)[];
export type EnqueueChapterDownloadsPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadStatus?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ExtensionEdgeKeySpecifier = ('cursor' | 'node' | ExtensionEdgeKeySpecifier)[];
export type ExtensionEdgeFieldPolicy = {
	cursor?: FieldPolicy<any> | FieldReadFunction<any>,
	node?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ExtensionNodeListKeySpecifier = ('edges' | 'nodes' | 'pageInfo' | 'totalCount' | ExtensionNodeListKeySpecifier)[];
export type ExtensionNodeListFieldPolicy = {
	edges?: FieldPolicy<any> | FieldReadFunction<any>,
	nodes?: FieldPolicy<any> | FieldReadFunction<any>,
	pageInfo?: FieldPolicy<any> | FieldReadFunction<any>,
	totalCount?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ExtensionTypeKeySpecifier = ('apkName' | 'hasUpdate' | 'iconUrl' | 'isInstalled' | 'isNsfw' | 'isObsolete' | 'lang' | 'name' | 'pkgName' | 'repo' | 'source' | 'versionCode' | 'versionName' | ExtensionTypeKeySpecifier)[];
export type ExtensionTypeFieldPolicy = {
	apkName?: FieldPolicy<any> | FieldReadFunction<any>,
	hasUpdate?: FieldPolicy<any> | FieldReadFunction<any>,
	iconUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	isInstalled?: FieldPolicy<any> | FieldReadFunction<any>,
	isNsfw?: FieldPolicy<any> | FieldReadFunction<any>,
	isObsolete?: FieldPolicy<any> | FieldReadFunction<any>,
	lang?: FieldPolicy<any> | FieldReadFunction<any>,
	name?: FieldPolicy<any> | FieldReadFunction<any>,
	pkgName?: FieldPolicy<any> | FieldReadFunction<any>,
	repo?: FieldPolicy<any> | FieldReadFunction<any>,
	source?: FieldPolicy<any> | FieldReadFunction<any>,
	versionCode?: FieldPolicy<any> | FieldReadFunction<any>,
	versionName?: FieldPolicy<any> | FieldReadFunction<any>
};
export type FetchChapterPagesPayloadKeySpecifier = ('chapter' | 'clientMutationId' | 'pages' | 'syncConflict' | FetchChapterPagesPayloadKeySpecifier)[];
export type FetchChapterPagesPayloadFieldPolicy = {
	chapter?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	pages?: FieldPolicy<any> | FieldReadFunction<any>,
	syncConflict?: FieldPolicy<any> | FieldReadFunction<any>
};
export type FetchChaptersPayloadKeySpecifier = ('chapters' | 'clientMutationId' | FetchChaptersPayloadKeySpecifier)[];
export type FetchChaptersPayloadFieldPolicy = {
	chapters?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>
};
export type FetchExtensionsPayloadKeySpecifier = ('clientMutationId' | 'extensions' | FetchExtensionsPayloadKeySpecifier)[];
export type FetchExtensionsPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	extensions?: FieldPolicy<any> | FieldReadFunction<any>
};
export type FetchMangaPayloadKeySpecifier = ('clientMutationId' | 'manga' | FetchMangaPayloadKeySpecifier)[];
export type FetchMangaPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	manga?: FieldPolicy<any> | FieldReadFunction<any>
};
export type FetchSourceMangaPayloadKeySpecifier = ('clientMutationId' | 'hasNextPage' | 'mangas' | FetchSourceMangaPayloadKeySpecifier)[];
export type FetchSourceMangaPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	hasNextPage?: FieldPolicy<any> | FieldReadFunction<any>,
	mangas?: FieldPolicy<any> | FieldReadFunction<any>
};
export type FetchTrackPayloadKeySpecifier = ('clientMutationId' | 'trackRecord' | FetchTrackPayloadKeySpecifier)[];
export type FetchTrackPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	trackRecord?: FieldPolicy<any> | FieldReadFunction<any>
};
export type GlobalMetaNodeListKeySpecifier = ('edges' | 'nodes' | 'pageInfo' | 'totalCount' | GlobalMetaNodeListKeySpecifier)[];
export type GlobalMetaNodeListFieldPolicy = {
	edges?: FieldPolicy<any> | FieldReadFunction<any>,
	nodes?: FieldPolicy<any> | FieldReadFunction<any>,
	pageInfo?: FieldPolicy<any> | FieldReadFunction<any>,
	totalCount?: FieldPolicy<any> | FieldReadFunction<any>
};
export type GlobalMetaTypeKeySpecifier = ('key' | 'value' | GlobalMetaTypeKeySpecifier)[];
export type GlobalMetaTypeFieldPolicy = {
	key?: FieldPolicy<any> | FieldReadFunction<any>,
	value?: FieldPolicy<any> | FieldReadFunction<any>
};
export type GroupFilterKeySpecifier = ('filters' | 'name' | GroupFilterKeySpecifier)[];
export type GroupFilterFieldPolicy = {
	filters?: FieldPolicy<any> | FieldReadFunction<any>,
	name?: FieldPolicy<any> | FieldReadFunction<any>
};
export type HeaderFilterKeySpecifier = ('name' | HeaderFilterKeySpecifier)[];
export type HeaderFilterFieldPolicy = {
	name?: FieldPolicy<any> | FieldReadFunction<any>
};
export type InstallExternalExtensionPayloadKeySpecifier = ('clientMutationId' | 'extension' | InstallExternalExtensionPayloadKeySpecifier)[];
export type InstallExternalExtensionPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	extension?: FieldPolicy<any> | FieldReadFunction<any>
};
export type KoSyncConnectPayloadKeySpecifier = ('clientMutationId' | 'message' | 'status' | KoSyncConnectPayloadKeySpecifier)[];
export type KoSyncConnectPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	message?: FieldPolicy<any> | FieldReadFunction<any>,
	status?: FieldPolicy<any> | FieldReadFunction<any>
};
export type KoSyncStatusPayloadKeySpecifier = ('isLoggedIn' | 'serverAddress' | 'username' | KoSyncStatusPayloadKeySpecifier)[];
export type KoSyncStatusPayloadFieldPolicy = {
	isLoggedIn?: FieldPolicy<any> | FieldReadFunction<any>,
	serverAddress?: FieldPolicy<any> | FieldReadFunction<any>,
	username?: FieldPolicy<any> | FieldReadFunction<any>
};
export type LastUpdateTimestampPayloadKeySpecifier = ('timestamp' | LastUpdateTimestampPayloadKeySpecifier)[];
export type LastUpdateTimestampPayloadFieldPolicy = {
	timestamp?: FieldPolicy<any> | FieldReadFunction<any>
};
export type LibraryUpdateStatusKeySpecifier = ('categoryUpdates' | 'jobsInfo' | 'mangaUpdates' | LibraryUpdateStatusKeySpecifier)[];
export type LibraryUpdateStatusFieldPolicy = {
	categoryUpdates?: FieldPolicy<any> | FieldReadFunction<any>,
	jobsInfo?: FieldPolicy<any> | FieldReadFunction<any>,
	mangaUpdates?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ListPreferenceKeySpecifier = ('currentValue' | 'default' | 'enabled' | 'entries' | 'entryValues' | 'key' | 'summary' | 'title' | 'visible' | ListPreferenceKeySpecifier)[];
export type ListPreferenceFieldPolicy = {
	currentValue?: FieldPolicy<any> | FieldReadFunction<any>,
	default?: FieldPolicy<any> | FieldReadFunction<any>,
	enabled?: FieldPolicy<any> | FieldReadFunction<any>,
	entries?: FieldPolicy<any> | FieldReadFunction<any>,
	entryValues?: FieldPolicy<any> | FieldReadFunction<any>,
	key?: FieldPolicy<any> | FieldReadFunction<any>,
	summary?: FieldPolicy<any> | FieldReadFunction<any>,
	title?: FieldPolicy<any> | FieldReadFunction<any>,
	visible?: FieldPolicy<any> | FieldReadFunction<any>
};
export type LoginPayloadKeySpecifier = ('accessToken' | 'clientMutationId' | 'refreshToken' | LoginPayloadKeySpecifier)[];
export type LoginPayloadFieldPolicy = {
	accessToken?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	refreshToken?: FieldPolicy<any> | FieldReadFunction<any>
};
export type LoginTrackerCredentialsPayloadKeySpecifier = ('clientMutationId' | 'isLoggedIn' | 'tracker' | LoginTrackerCredentialsPayloadKeySpecifier)[];
export type LoginTrackerCredentialsPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	isLoggedIn?: FieldPolicy<any> | FieldReadFunction<any>,
	tracker?: FieldPolicy<any> | FieldReadFunction<any>
};
export type LoginTrackerOAuthPayloadKeySpecifier = ('clientMutationId' | 'isLoggedIn' | 'tracker' | LoginTrackerOAuthPayloadKeySpecifier)[];
export type LoginTrackerOAuthPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	isLoggedIn?: FieldPolicy<any> | FieldReadFunction<any>,
	tracker?: FieldPolicy<any> | FieldReadFunction<any>
};
export type LogoutKoSyncAccountPayloadKeySpecifier = ('clientMutationId' | 'status' | LogoutKoSyncAccountPayloadKeySpecifier)[];
export type LogoutKoSyncAccountPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	status?: FieldPolicy<any> | FieldReadFunction<any>
};
export type LogoutTrackerPayloadKeySpecifier = ('clientMutationId' | 'isLoggedIn' | 'tracker' | LogoutTrackerPayloadKeySpecifier)[];
export type LogoutTrackerPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	isLoggedIn?: FieldPolicy<any> | FieldReadFunction<any>,
	tracker?: FieldPolicy<any> | FieldReadFunction<any>
};
export type MangaEdgeKeySpecifier = ('cursor' | 'node' | MangaEdgeKeySpecifier)[];
export type MangaEdgeFieldPolicy = {
	cursor?: FieldPolicy<any> | FieldReadFunction<any>,
	node?: FieldPolicy<any> | FieldReadFunction<any>
};
export type MangaMetaTypeKeySpecifier = ('key' | 'manga' | 'mangaId' | 'value' | MangaMetaTypeKeySpecifier)[];
export type MangaMetaTypeFieldPolicy = {
	key?: FieldPolicy<any> | FieldReadFunction<any>,
	manga?: FieldPolicy<any> | FieldReadFunction<any>,
	mangaId?: FieldPolicy<any> | FieldReadFunction<any>,
	value?: FieldPolicy<any> | FieldReadFunction<any>
};
export type MangaNodeListKeySpecifier = ('edges' | 'nodes' | 'pageInfo' | 'totalCount' | MangaNodeListKeySpecifier)[];
export type MangaNodeListFieldPolicy = {
	edges?: FieldPolicy<any> | FieldReadFunction<any>,
	nodes?: FieldPolicy<any> | FieldReadFunction<any>,
	pageInfo?: FieldPolicy<any> | FieldReadFunction<any>,
	totalCount?: FieldPolicy<any> | FieldReadFunction<any>
};
export type MangaTypeKeySpecifier = ('age' | 'artist' | 'author' | 'bookmarkCount' | 'categories' | 'chapters' | 'chaptersAge' | 'chaptersLastFetchedAt' | 'description' | 'downloadCount' | 'firstUnreadChapter' | 'genre' | 'hasDuplicateChapters' | 'highestNumberedChapter' | 'id' | 'inLibrary' | 'inLibraryAt' | 'initialized' | 'lastFetchedAt' | 'lastReadChapter' | 'latestFetchedChapter' | 'latestReadChapter' | 'latestUploadedChapter' | 'meta' | 'realUrl' | 'source' | 'sourceId' | 'status' | 'thumbnailUrl' | 'thumbnailUrlLastFetched' | 'title' | 'trackRecords' | 'unreadCount' | 'updateStrategy' | 'url' | MangaTypeKeySpecifier)[];
export type MangaTypeFieldPolicy = {
	age?: FieldPolicy<any> | FieldReadFunction<any>,
	artist?: FieldPolicy<any> | FieldReadFunction<any>,
	author?: FieldPolicy<any> | FieldReadFunction<any>,
	bookmarkCount?: FieldPolicy<any> | FieldReadFunction<any>,
	categories?: FieldPolicy<any> | FieldReadFunction<any>,
	chapters?: FieldPolicy<any> | FieldReadFunction<any>,
	chaptersAge?: FieldPolicy<any> | FieldReadFunction<any>,
	chaptersLastFetchedAt?: FieldPolicy<any> | FieldReadFunction<any>,
	description?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadCount?: FieldPolicy<any> | FieldReadFunction<any>,
	firstUnreadChapter?: FieldPolicy<any> | FieldReadFunction<any>,
	genre?: FieldPolicy<any> | FieldReadFunction<any>,
	hasDuplicateChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	highestNumberedChapter?: FieldPolicy<any> | FieldReadFunction<any>,
	id?: FieldPolicy<any> | FieldReadFunction<any>,
	inLibrary?: FieldPolicy<any> | FieldReadFunction<any>,
	inLibraryAt?: FieldPolicy<any> | FieldReadFunction<any>,
	initialized?: FieldPolicy<any> | FieldReadFunction<any>,
	lastFetchedAt?: FieldPolicy<any> | FieldReadFunction<any>,
	lastReadChapter?: FieldPolicy<any> | FieldReadFunction<any>,
	latestFetchedChapter?: FieldPolicy<any> | FieldReadFunction<any>,
	latestReadChapter?: FieldPolicy<any> | FieldReadFunction<any>,
	latestUploadedChapter?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>,
	realUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	source?: FieldPolicy<any> | FieldReadFunction<any>,
	sourceId?: FieldPolicy<any> | FieldReadFunction<any>,
	status?: FieldPolicy<any> | FieldReadFunction<any>,
	thumbnailUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	thumbnailUrlLastFetched?: FieldPolicy<any> | FieldReadFunction<any>,
	title?: FieldPolicy<any> | FieldReadFunction<any>,
	trackRecords?: FieldPolicy<any> | FieldReadFunction<any>,
	unreadCount?: FieldPolicy<any> | FieldReadFunction<any>,
	updateStrategy?: FieldPolicy<any> | FieldReadFunction<any>,
	url?: FieldPolicy<any> | FieldReadFunction<any>
};
export type MangaUpdateTypeKeySpecifier = ('manga' | 'status' | MangaUpdateTypeKeySpecifier)[];
export type MangaUpdateTypeFieldPolicy = {
	manga?: FieldPolicy<any> | FieldReadFunction<any>,
	status?: FieldPolicy<any> | FieldReadFunction<any>
};
export type MetaEdgeKeySpecifier = ('cursor' | 'node' | MetaEdgeKeySpecifier)[];
export type MetaEdgeFieldPolicy = {
	cursor?: FieldPolicy<any> | FieldReadFunction<any>,
	node?: FieldPolicy<any> | FieldReadFunction<any>
};
export type MetaTypeKeySpecifier = ('key' | 'value' | MetaTypeKeySpecifier)[];
export type MetaTypeFieldPolicy = {
	key?: FieldPolicy<any> | FieldReadFunction<any>,
	value?: FieldPolicy<any> | FieldReadFunction<any>
};
export type MultiSelectListPreferenceKeySpecifier = ('currentValue' | 'default' | 'dialogMessage' | 'dialogTitle' | 'enabled' | 'entries' | 'entryValues' | 'key' | 'summary' | 'title' | 'visible' | MultiSelectListPreferenceKeySpecifier)[];
export type MultiSelectListPreferenceFieldPolicy = {
	currentValue?: FieldPolicy<any> | FieldReadFunction<any>,
	default?: FieldPolicy<any> | FieldReadFunction<any>,
	dialogMessage?: FieldPolicy<any> | FieldReadFunction<any>,
	dialogTitle?: FieldPolicy<any> | FieldReadFunction<any>,
	enabled?: FieldPolicy<any> | FieldReadFunction<any>,
	entries?: FieldPolicy<any> | FieldReadFunction<any>,
	entryValues?: FieldPolicy<any> | FieldReadFunction<any>,
	key?: FieldPolicy<any> | FieldReadFunction<any>,
	summary?: FieldPolicy<any> | FieldReadFunction<any>,
	title?: FieldPolicy<any> | FieldReadFunction<any>,
	visible?: FieldPolicy<any> | FieldReadFunction<any>
};
export type MutationKeySpecifier = ('bindTrack' | 'clearCachedImages' | 'clearDownloader' | 'connectKoSyncAccount' | 'createBackup' | 'createCategory' | 'deleteCategory' | 'deleteCategoryMeta' | 'deleteChapterMeta' | 'deleteDownloadedChapter' | 'deleteDownloadedChapters' | 'deleteGlobalMeta' | 'deleteMangaMeta' | 'deleteSourceMeta' | 'dequeueChapterDownload' | 'dequeueChapterDownloads' | 'enqueueChapterDownload' | 'enqueueChapterDownloads' | 'fetchChapterPages' | 'fetchChapters' | 'fetchExtensions' | 'fetchManga' | 'fetchSourceManga' | 'fetchTrack' | 'installExternalExtension' | 'login' | 'loginTrackerCredentials' | 'loginTrackerOAuth' | 'logoutKoSyncAccount' | 'logoutTracker' | 'pullKoSyncProgress' | 'pushKoSyncProgress' | 'refreshToken' | 'reorderChapterDownload' | 'resetSettings' | 'resetWebUIUpdateStatus' | 'restoreBackup' | 'setCategoryMeta' | 'setChapterMeta' | 'setGlobalMeta' | 'setMangaMeta' | 'setSettings' | 'setSourceMeta' | 'startDownloader' | 'stopDownloader' | 'trackProgress' | 'unbindTrack' | 'updateCategories' | 'updateCategory' | 'updateCategoryManga' | 'updateCategoryOrder' | 'updateChapter' | 'updateChapters' | 'updateExtension' | 'updateExtensions' | 'updateLibrary' | 'updateLibraryManga' | 'updateManga' | 'updateMangaCategories' | 'updateMangas' | 'updateMangasCategories' | 'updateSourcePreference' | 'updateStop' | 'updateTrack' | 'updateWebUI' | MutationKeySpecifier)[];
export type MutationFieldPolicy = {
	bindTrack?: FieldPolicy<any> | FieldReadFunction<any>,
	clearCachedImages?: FieldPolicy<any> | FieldReadFunction<any>,
	clearDownloader?: FieldPolicy<any> | FieldReadFunction<any>,
	connectKoSyncAccount?: FieldPolicy<any> | FieldReadFunction<any>,
	createBackup?: FieldPolicy<any> | FieldReadFunction<any>,
	createCategory?: FieldPolicy<any> | FieldReadFunction<any>,
	deleteCategory?: FieldPolicy<any> | FieldReadFunction<any>,
	deleteCategoryMeta?: FieldPolicy<any> | FieldReadFunction<any>,
	deleteChapterMeta?: FieldPolicy<any> | FieldReadFunction<any>,
	deleteDownloadedChapter?: FieldPolicy<any> | FieldReadFunction<any>,
	deleteDownloadedChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	deleteGlobalMeta?: FieldPolicy<any> | FieldReadFunction<any>,
	deleteMangaMeta?: FieldPolicy<any> | FieldReadFunction<any>,
	deleteSourceMeta?: FieldPolicy<any> | FieldReadFunction<any>,
	dequeueChapterDownload?: FieldPolicy<any> | FieldReadFunction<any>,
	dequeueChapterDownloads?: FieldPolicy<any> | FieldReadFunction<any>,
	enqueueChapterDownload?: FieldPolicy<any> | FieldReadFunction<any>,
	enqueueChapterDownloads?: FieldPolicy<any> | FieldReadFunction<any>,
	fetchChapterPages?: FieldPolicy<any> | FieldReadFunction<any>,
	fetchChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	fetchExtensions?: FieldPolicy<any> | FieldReadFunction<any>,
	fetchManga?: FieldPolicy<any> | FieldReadFunction<any>,
	fetchSourceManga?: FieldPolicy<any> | FieldReadFunction<any>,
	fetchTrack?: FieldPolicy<any> | FieldReadFunction<any>,
	installExternalExtension?: FieldPolicy<any> | FieldReadFunction<any>,
	login?: FieldPolicy<any> | FieldReadFunction<any>,
	loginTrackerCredentials?: FieldPolicy<any> | FieldReadFunction<any>,
	loginTrackerOAuth?: FieldPolicy<any> | FieldReadFunction<any>,
	logoutKoSyncAccount?: FieldPolicy<any> | FieldReadFunction<any>,
	logoutTracker?: FieldPolicy<any> | FieldReadFunction<any>,
	pullKoSyncProgress?: FieldPolicy<any> | FieldReadFunction<any>,
	pushKoSyncProgress?: FieldPolicy<any> | FieldReadFunction<any>,
	refreshToken?: FieldPolicy<any> | FieldReadFunction<any>,
	reorderChapterDownload?: FieldPolicy<any> | FieldReadFunction<any>,
	resetSettings?: FieldPolicy<any> | FieldReadFunction<any>,
	resetWebUIUpdateStatus?: FieldPolicy<any> | FieldReadFunction<any>,
	restoreBackup?: FieldPolicy<any> | FieldReadFunction<any>,
	setCategoryMeta?: FieldPolicy<any> | FieldReadFunction<any>,
	setChapterMeta?: FieldPolicy<any> | FieldReadFunction<any>,
	setGlobalMeta?: FieldPolicy<any> | FieldReadFunction<any>,
	setMangaMeta?: FieldPolicy<any> | FieldReadFunction<any>,
	setSettings?: FieldPolicy<any> | FieldReadFunction<any>,
	setSourceMeta?: FieldPolicy<any> | FieldReadFunction<any>,
	startDownloader?: FieldPolicy<any> | FieldReadFunction<any>,
	stopDownloader?: FieldPolicy<any> | FieldReadFunction<any>,
	trackProgress?: FieldPolicy<any> | FieldReadFunction<any>,
	unbindTrack?: FieldPolicy<any> | FieldReadFunction<any>,
	updateCategories?: FieldPolicy<any> | FieldReadFunction<any>,
	updateCategory?: FieldPolicy<any> | FieldReadFunction<any>,
	updateCategoryManga?: FieldPolicy<any> | FieldReadFunction<any>,
	updateCategoryOrder?: FieldPolicy<any> | FieldReadFunction<any>,
	updateChapter?: FieldPolicy<any> | FieldReadFunction<any>,
	updateChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	updateExtension?: FieldPolicy<any> | FieldReadFunction<any>,
	updateExtensions?: FieldPolicy<any> | FieldReadFunction<any>,
	updateLibrary?: FieldPolicy<any> | FieldReadFunction<any>,
	updateLibraryManga?: FieldPolicy<any> | FieldReadFunction<any>,
	updateManga?: FieldPolicy<any> | FieldReadFunction<any>,
	updateMangaCategories?: FieldPolicy<any> | FieldReadFunction<any>,
	updateMangas?: FieldPolicy<any> | FieldReadFunction<any>,
	updateMangasCategories?: FieldPolicy<any> | FieldReadFunction<any>,
	updateSourcePreference?: FieldPolicy<any> | FieldReadFunction<any>,
	updateStop?: FieldPolicy<any> | FieldReadFunction<any>,
	updateTrack?: FieldPolicy<any> | FieldReadFunction<any>,
	updateWebUI?: FieldPolicy<any> | FieldReadFunction<any>
};
export type NodeListKeySpecifier = ('edges' | 'nodes' | 'pageInfo' | 'totalCount' | NodeListKeySpecifier)[];
export type NodeListFieldPolicy = {
	edges?: FieldPolicy<any> | FieldReadFunction<any>,
	nodes?: FieldPolicy<any> | FieldReadFunction<any>,
	pageInfo?: FieldPolicy<any> | FieldReadFunction<any>,
	totalCount?: FieldPolicy<any> | FieldReadFunction<any>
};
export type PageInfoKeySpecifier = ('endCursor' | 'hasNextPage' | 'hasPreviousPage' | 'startCursor' | PageInfoKeySpecifier)[];
export type PageInfoFieldPolicy = {
	endCursor?: FieldPolicy<any> | FieldReadFunction<any>,
	hasNextPage?: FieldPolicy<any> | FieldReadFunction<any>,
	hasPreviousPage?: FieldPolicy<any> | FieldReadFunction<any>,
	startCursor?: FieldPolicy<any> | FieldReadFunction<any>
};
export type PartialSettingsTypeKeySpecifier = ('authMode' | 'authPassword' | 'authUsername' | 'autoBackupIncludeCategories' | 'autoBackupIncludeChapters' | 'autoBackupIncludeClientData' | 'autoBackupIncludeHistory' | 'autoBackupIncludeManga' | 'autoBackupIncludeServerSettings' | 'autoBackupIncludeTracking' | 'autoDownloadAheadLimit' | 'autoDownloadIgnoreReUploads' | 'autoDownloadNewChapters' | 'autoDownloadNewChaptersLimit' | 'backupInterval' | 'backupPath' | 'backupTTL' | 'backupTime' | 'basicAuthEnabled' | 'basicAuthPassword' | 'basicAuthUsername' | 'databasePassword' | 'databaseType' | 'databaseUrl' | 'databaseUsername' | 'debugLogsEnabled' | 'downloadAsCbz' | 'downloadConversions' | 'downloadsPath' | 'electronPath' | 'excludeCompleted' | 'excludeEntryWithUnreadChapters' | 'excludeNotStarted' | 'excludeUnreadChapters' | 'extensionRepos' | 'flareSolverrAsResponseFallback' | 'flareSolverrEnabled' | 'flareSolverrSessionName' | 'flareSolverrSessionTtl' | 'flareSolverrTimeout' | 'flareSolverrUrl' | 'globalUpdateInterval' | 'gqlDebugLogsEnabled' | 'initialOpenInBrowserEnabled' | 'ip' | 'jwtAudience' | 'jwtRefreshExpiry' | 'jwtTokenExpiry' | 'koreaderSyncChecksumMethod' | 'koreaderSyncDeviceId' | 'koreaderSyncPercentageTolerance' | 'koreaderSyncServerUrl' | 'koreaderSyncStrategy' | 'koreaderSyncStrategyBackward' | 'koreaderSyncStrategyForward' | 'koreaderSyncUserkey' | 'koreaderSyncUsername' | 'localSourcePath' | 'maxLogFileSize' | 'maxLogFiles' | 'maxLogFolderSize' | 'maxSourcesInParallel' | 'opdsCbzMimetype' | 'opdsChapterSortOrder' | 'opdsEnablePageReadProgress' | 'opdsItemsPerPage' | 'opdsMarkAsReadOnDownload' | 'opdsShowOnlyDownloadedChapters' | 'opdsShowOnlyUnreadChapters' | 'opdsUseBinaryFileSizes' | 'port' | 'serveConversions' | 'socksProxyEnabled' | 'socksProxyHost' | 'socksProxyPassword' | 'socksProxyPort' | 'socksProxyUsername' | 'socksProxyVersion' | 'systemTrayEnabled' | 'updateMangas' | 'useHikariConnectionPool' | 'webUIChannel' | 'webUIFlavor' | 'webUIInterface' | 'webUIUpdateCheckInterval' | PartialSettingsTypeKeySpecifier)[];
export type PartialSettingsTypeFieldPolicy = {
	authMode?: FieldPolicy<any> | FieldReadFunction<any>,
	authPassword?: FieldPolicy<any> | FieldReadFunction<any>,
	authUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeCategories?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeClientData?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeHistory?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeManga?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeServerSettings?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeTracking?: FieldPolicy<any> | FieldReadFunction<any>,
	autoDownloadAheadLimit?: FieldPolicy<any> | FieldReadFunction<any>,
	autoDownloadIgnoreReUploads?: FieldPolicy<any> | FieldReadFunction<any>,
	autoDownloadNewChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	autoDownloadNewChaptersLimit?: FieldPolicy<any> | FieldReadFunction<any>,
	backupInterval?: FieldPolicy<any> | FieldReadFunction<any>,
	backupPath?: FieldPolicy<any> | FieldReadFunction<any>,
	backupTTL?: FieldPolicy<any> | FieldReadFunction<any>,
	backupTime?: FieldPolicy<any> | FieldReadFunction<any>,
	basicAuthEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	basicAuthPassword?: FieldPolicy<any> | FieldReadFunction<any>,
	basicAuthUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	databasePassword?: FieldPolicy<any> | FieldReadFunction<any>,
	databaseType?: FieldPolicy<any> | FieldReadFunction<any>,
	databaseUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	databaseUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	debugLogsEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadAsCbz?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadConversions?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadsPath?: FieldPolicy<any> | FieldReadFunction<any>,
	electronPath?: FieldPolicy<any> | FieldReadFunction<any>,
	excludeCompleted?: FieldPolicy<any> | FieldReadFunction<any>,
	excludeEntryWithUnreadChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	excludeNotStarted?: FieldPolicy<any> | FieldReadFunction<any>,
	excludeUnreadChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	extensionRepos?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrAsResponseFallback?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrSessionName?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrSessionTtl?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrTimeout?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	globalUpdateInterval?: FieldPolicy<any> | FieldReadFunction<any>,
	gqlDebugLogsEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	initialOpenInBrowserEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	ip?: FieldPolicy<any> | FieldReadFunction<any>,
	jwtAudience?: FieldPolicy<any> | FieldReadFunction<any>,
	jwtRefreshExpiry?: FieldPolicy<any> | FieldReadFunction<any>,
	jwtTokenExpiry?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncChecksumMethod?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncDeviceId?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncPercentageTolerance?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncServerUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncStrategy?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncStrategyBackward?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncStrategyForward?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncUserkey?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	localSourcePath?: FieldPolicy<any> | FieldReadFunction<any>,
	maxLogFileSize?: FieldPolicy<any> | FieldReadFunction<any>,
	maxLogFiles?: FieldPolicy<any> | FieldReadFunction<any>,
	maxLogFolderSize?: FieldPolicy<any> | FieldReadFunction<any>,
	maxSourcesInParallel?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsCbzMimetype?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsChapterSortOrder?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsEnablePageReadProgress?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsItemsPerPage?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsMarkAsReadOnDownload?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsShowOnlyDownloadedChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsShowOnlyUnreadChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsUseBinaryFileSizes?: FieldPolicy<any> | FieldReadFunction<any>,
	port?: FieldPolicy<any> | FieldReadFunction<any>,
	serveConversions?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyHost?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyPassword?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyPort?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyVersion?: FieldPolicy<any> | FieldReadFunction<any>,
	systemTrayEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	updateMangas?: FieldPolicy<any> | FieldReadFunction<any>,
	useHikariConnectionPool?: FieldPolicy<any> | FieldReadFunction<any>,
	webUIChannel?: FieldPolicy<any> | FieldReadFunction<any>,
	webUIFlavor?: FieldPolicy<any> | FieldReadFunction<any>,
	webUIInterface?: FieldPolicy<any> | FieldReadFunction<any>,
	webUIUpdateCheckInterval?: FieldPolicy<any> | FieldReadFunction<any>
};
export type PullKoSyncProgressPayloadKeySpecifier = ('chapter' | 'clientMutationId' | 'syncConflict' | PullKoSyncProgressPayloadKeySpecifier)[];
export type PullKoSyncProgressPayloadFieldPolicy = {
	chapter?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	syncConflict?: FieldPolicy<any> | FieldReadFunction<any>
};
export type PushKoSyncProgressPayloadKeySpecifier = ('chapter' | 'clientMutationId' | 'success' | PushKoSyncProgressPayloadKeySpecifier)[];
export type PushKoSyncProgressPayloadFieldPolicy = {
	chapter?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	success?: FieldPolicy<any> | FieldReadFunction<any>
};
export type QueryKeySpecifier = ('aboutServer' | 'categories' | 'category' | 'chapter' | 'chapters' | 'checkForServerUpdates' | 'downloadStatus' | 'extension' | 'extensions' | 'koSyncStatus' | 'lastUpdateTimestamp' | 'libraryUpdateStatus' | 'manga' | 'mangas' | 'meta' | 'metas' | 'restoreStatus' | 'searchTracker' | 'settings' | 'source' | 'sources' | 'trackRecord' | 'trackRecords' | 'tracker' | 'trackers' | 'updateStatus' | 'validateBackup' | QueryKeySpecifier)[];
export type QueryFieldPolicy = {
	aboutServer?: FieldPolicy<any> | FieldReadFunction<any>,
	categories?: FieldPolicy<any> | FieldReadFunction<any>,
	category?: FieldPolicy<any> | FieldReadFunction<any>,
	chapter?: FieldPolicy<any> | FieldReadFunction<any>,
	chapters?: FieldPolicy<GetChaptersMangaQuery['chapters']> | FieldReadFunction<GetChaptersMangaQuery['chapters']>,
	checkForServerUpdates?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadStatus?: FieldPolicy<Reference, Reference, Reference, FieldFunctionOptions<GetDownloadStatusQueryVariables>> | FieldReadFunction<Reference, Reference, FieldFunctionOptions<GetDownloadStatusQueryVariables>>,
	extension?: FieldPolicy<any> | FieldReadFunction<any>,
	extensions?: FieldPolicy<any> | FieldReadFunction<any>,
	koSyncStatus?: FieldPolicy<any> | FieldReadFunction<any>,
	lastUpdateTimestamp?: FieldPolicy<any> | FieldReadFunction<any>,
	libraryUpdateStatus?: FieldPolicy<Reference, Reference, Reference, FieldFunctionOptions<GetUpdateStatusQueryVariables>> | FieldReadFunction<Reference, Reference, FieldFunctionOptions<GetUpdateStatusQueryVariables>>,
	manga?: FieldPolicy<Reference, Reference, Reference, FieldFunctionOptions<GetMangaScreenQueryVariables>> | FieldReadFunction<Reference, Reference, FieldFunctionOptions<GetMangaScreenQueryVariables>>,
	mangas?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<Reference, Reference, Reference, FieldFunctionOptions<GetGlobalMetadataQueryVariables>> | FieldReadFunction<Reference, Reference, FieldFunctionOptions<GetGlobalMetadataQueryVariables>>,
	metas?: FieldPolicy<any> | FieldReadFunction<any>,
	restoreStatus?: FieldPolicy<any> | FieldReadFunction<any>,
	searchTracker?: FieldPolicy<any> | FieldReadFunction<any>,
	settings?: FieldPolicy<any> | FieldReadFunction<any>,
	source?: FieldPolicy<Reference, Reference, Reference, FieldFunctionOptions<GetSourceBrowseQueryVariables>> | FieldReadFunction<Reference, Reference, FieldFunctionOptions<GetSourceBrowseQueryVariables>>,
	sources?: FieldPolicy<any> | FieldReadFunction<any>,
	trackRecord?: FieldPolicy<any> | FieldReadFunction<any>,
	trackRecords?: FieldPolicy<any> | FieldReadFunction<any>,
	tracker?: FieldPolicy<any> | FieldReadFunction<any>,
	trackers?: FieldPolicy<any> | FieldReadFunction<any>,
	updateStatus?: FieldPolicy<any> | FieldReadFunction<any>,
	validateBackup?: FieldPolicy<any> | FieldReadFunction<any>
};
export type RefreshTokenPayloadKeySpecifier = ('accessToken' | 'clientMutationId' | RefreshTokenPayloadKeySpecifier)[];
export type RefreshTokenPayloadFieldPolicy = {
	accessToken?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ReorderChapterDownloadPayloadKeySpecifier = ('clientMutationId' | 'downloadStatus' | ReorderChapterDownloadPayloadKeySpecifier)[];
export type ReorderChapterDownloadPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadStatus?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ResetSettingsPayloadKeySpecifier = ('clientMutationId' | 'settings' | ResetSettingsPayloadKeySpecifier)[];
export type ResetSettingsPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	settings?: FieldPolicy<any> | FieldReadFunction<any>
};
export type RestoreBackupPayloadKeySpecifier = ('clientMutationId' | 'id' | 'status' | RestoreBackupPayloadKeySpecifier)[];
export type RestoreBackupPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	id?: FieldPolicy<any> | FieldReadFunction<any>,
	status?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SearchTrackerPayloadKeySpecifier = ('trackSearches' | SearchTrackerPayloadKeySpecifier)[];
export type SearchTrackerPayloadFieldPolicy = {
	trackSearches?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SelectFilterKeySpecifier = ('default' | 'name' | 'values' | SelectFilterKeySpecifier)[];
export type SelectFilterFieldPolicy = {
	default?: FieldPolicy<any> | FieldReadFunction<any>,
	name?: FieldPolicy<any> | FieldReadFunction<any>,
	values?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SeparatorFilterKeySpecifier = ('name' | SeparatorFilterKeySpecifier)[];
export type SeparatorFilterFieldPolicy = {
	name?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SetCategoryMetaPayloadKeySpecifier = ('clientMutationId' | 'meta' | SetCategoryMetaPayloadKeySpecifier)[];
export type SetCategoryMetaPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SetChapterMetaPayloadKeySpecifier = ('clientMutationId' | 'meta' | SetChapterMetaPayloadKeySpecifier)[];
export type SetChapterMetaPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SetGlobalMetaPayloadKeySpecifier = ('clientMutationId' | 'meta' | SetGlobalMetaPayloadKeySpecifier)[];
export type SetGlobalMetaPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SetMangaMetaPayloadKeySpecifier = ('clientMutationId' | 'meta' | SetMangaMetaPayloadKeySpecifier)[];
export type SetMangaMetaPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SetSettingsPayloadKeySpecifier = ('clientMutationId' | 'settings' | SetSettingsPayloadKeySpecifier)[];
export type SetSettingsPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	settings?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SetSourceMetaPayloadKeySpecifier = ('clientMutationId' | 'meta' | SetSourceMetaPayloadKeySpecifier)[];
export type SetSourceMetaPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SettingsKeySpecifier = ('authMode' | 'authPassword' | 'authUsername' | 'autoBackupIncludeCategories' | 'autoBackupIncludeChapters' | 'autoBackupIncludeClientData' | 'autoBackupIncludeHistory' | 'autoBackupIncludeManga' | 'autoBackupIncludeServerSettings' | 'autoBackupIncludeTracking' | 'autoDownloadAheadLimit' | 'autoDownloadIgnoreReUploads' | 'autoDownloadNewChapters' | 'autoDownloadNewChaptersLimit' | 'backupInterval' | 'backupPath' | 'backupTTL' | 'backupTime' | 'basicAuthEnabled' | 'basicAuthPassword' | 'basicAuthUsername' | 'databasePassword' | 'databaseType' | 'databaseUrl' | 'databaseUsername' | 'debugLogsEnabled' | 'downloadAsCbz' | 'downloadConversions' | 'downloadsPath' | 'electronPath' | 'excludeCompleted' | 'excludeEntryWithUnreadChapters' | 'excludeNotStarted' | 'excludeUnreadChapters' | 'extensionRepos' | 'flareSolverrAsResponseFallback' | 'flareSolverrEnabled' | 'flareSolverrSessionName' | 'flareSolverrSessionTtl' | 'flareSolverrTimeout' | 'flareSolverrUrl' | 'globalUpdateInterval' | 'gqlDebugLogsEnabled' | 'initialOpenInBrowserEnabled' | 'ip' | 'jwtAudience' | 'jwtRefreshExpiry' | 'jwtTokenExpiry' | 'koreaderSyncChecksumMethod' | 'koreaderSyncDeviceId' | 'koreaderSyncPercentageTolerance' | 'koreaderSyncServerUrl' | 'koreaderSyncStrategy' | 'koreaderSyncStrategyBackward' | 'koreaderSyncStrategyForward' | 'koreaderSyncUserkey' | 'koreaderSyncUsername' | 'localSourcePath' | 'maxLogFileSize' | 'maxLogFiles' | 'maxLogFolderSize' | 'maxSourcesInParallel' | 'opdsCbzMimetype' | 'opdsChapterSortOrder' | 'opdsEnablePageReadProgress' | 'opdsItemsPerPage' | 'opdsMarkAsReadOnDownload' | 'opdsShowOnlyDownloadedChapters' | 'opdsShowOnlyUnreadChapters' | 'opdsUseBinaryFileSizes' | 'port' | 'serveConversions' | 'socksProxyEnabled' | 'socksProxyHost' | 'socksProxyPassword' | 'socksProxyPort' | 'socksProxyUsername' | 'socksProxyVersion' | 'systemTrayEnabled' | 'updateMangas' | 'useHikariConnectionPool' | 'webUIChannel' | 'webUIFlavor' | 'webUIInterface' | 'webUIUpdateCheckInterval' | SettingsKeySpecifier)[];
export type SettingsFieldPolicy = {
	authMode?: FieldPolicy<any> | FieldReadFunction<any>,
	authPassword?: FieldPolicy<any> | FieldReadFunction<any>,
	authUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeCategories?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeClientData?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeHistory?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeManga?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeServerSettings?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeTracking?: FieldPolicy<any> | FieldReadFunction<any>,
	autoDownloadAheadLimit?: FieldPolicy<any> | FieldReadFunction<any>,
	autoDownloadIgnoreReUploads?: FieldPolicy<any> | FieldReadFunction<any>,
	autoDownloadNewChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	autoDownloadNewChaptersLimit?: FieldPolicy<any> | FieldReadFunction<any>,
	backupInterval?: FieldPolicy<any> | FieldReadFunction<any>,
	backupPath?: FieldPolicy<any> | FieldReadFunction<any>,
	backupTTL?: FieldPolicy<any> | FieldReadFunction<any>,
	backupTime?: FieldPolicy<any> | FieldReadFunction<any>,
	basicAuthEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	basicAuthPassword?: FieldPolicy<any> | FieldReadFunction<any>,
	basicAuthUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	databasePassword?: FieldPolicy<any> | FieldReadFunction<any>,
	databaseType?: FieldPolicy<any> | FieldReadFunction<any>,
	databaseUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	databaseUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	debugLogsEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadAsCbz?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadConversions?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadsPath?: FieldPolicy<any> | FieldReadFunction<any>,
	electronPath?: FieldPolicy<any> | FieldReadFunction<any>,
	excludeCompleted?: FieldPolicy<any> | FieldReadFunction<any>,
	excludeEntryWithUnreadChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	excludeNotStarted?: FieldPolicy<any> | FieldReadFunction<any>,
	excludeUnreadChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	extensionRepos?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrAsResponseFallback?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrSessionName?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrSessionTtl?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrTimeout?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	globalUpdateInterval?: FieldPolicy<any> | FieldReadFunction<any>,
	gqlDebugLogsEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	initialOpenInBrowserEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	ip?: FieldPolicy<any> | FieldReadFunction<any>,
	jwtAudience?: FieldPolicy<any> | FieldReadFunction<any>,
	jwtRefreshExpiry?: FieldPolicy<any> | FieldReadFunction<any>,
	jwtTokenExpiry?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncChecksumMethod?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncDeviceId?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncPercentageTolerance?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncServerUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncStrategy?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncStrategyBackward?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncStrategyForward?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncUserkey?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	localSourcePath?: FieldPolicy<any> | FieldReadFunction<any>,
	maxLogFileSize?: FieldPolicy<any> | FieldReadFunction<any>,
	maxLogFiles?: FieldPolicy<any> | FieldReadFunction<any>,
	maxLogFolderSize?: FieldPolicy<any> | FieldReadFunction<any>,
	maxSourcesInParallel?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsCbzMimetype?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsChapterSortOrder?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsEnablePageReadProgress?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsItemsPerPage?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsMarkAsReadOnDownload?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsShowOnlyDownloadedChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsShowOnlyUnreadChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsUseBinaryFileSizes?: FieldPolicy<any> | FieldReadFunction<any>,
	port?: FieldPolicy<any> | FieldReadFunction<any>,
	serveConversions?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyHost?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyPassword?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyPort?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyVersion?: FieldPolicy<any> | FieldReadFunction<any>,
	systemTrayEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	updateMangas?: FieldPolicy<any> | FieldReadFunction<any>,
	useHikariConnectionPool?: FieldPolicy<any> | FieldReadFunction<any>,
	webUIChannel?: FieldPolicy<any> | FieldReadFunction<any>,
	webUIFlavor?: FieldPolicy<any> | FieldReadFunction<any>,
	webUIInterface?: FieldPolicy<any> | FieldReadFunction<any>,
	webUIUpdateCheckInterval?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SettingsDownloadConversionKeySpecifier = ('callTimeout' | 'compressionLevel' | 'connectTimeout' | 'headers' | 'mimeType' | 'target' | SettingsDownloadConversionKeySpecifier)[];
export type SettingsDownloadConversionFieldPolicy = {
	callTimeout?: FieldPolicy<any> | FieldReadFunction<any>,
	compressionLevel?: FieldPolicy<any> | FieldReadFunction<any>,
	connectTimeout?: FieldPolicy<any> | FieldReadFunction<any>,
	headers?: FieldPolicy<any> | FieldReadFunction<any>,
	mimeType?: FieldPolicy<any> | FieldReadFunction<any>,
	target?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SettingsDownloadConversionHeaderKeySpecifier = ('name' | 'value' | SettingsDownloadConversionHeaderKeySpecifier)[];
export type SettingsDownloadConversionHeaderFieldPolicy = {
	name?: FieldPolicy<any> | FieldReadFunction<any>,
	value?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SettingsDownloadConversionHeaderTypeKeySpecifier = ('name' | 'value' | SettingsDownloadConversionHeaderTypeKeySpecifier)[];
export type SettingsDownloadConversionHeaderTypeFieldPolicy = {
	name?: FieldPolicy<any> | FieldReadFunction<any>,
	value?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SettingsDownloadConversionTypeKeySpecifier = ('callTimeout' | 'compressionLevel' | 'connectTimeout' | 'headers' | 'mimeType' | 'target' | SettingsDownloadConversionTypeKeySpecifier)[];
export type SettingsDownloadConversionTypeFieldPolicy = {
	callTimeout?: FieldPolicy<any> | FieldReadFunction<any>,
	compressionLevel?: FieldPolicy<any> | FieldReadFunction<any>,
	connectTimeout?: FieldPolicy<any> | FieldReadFunction<any>,
	headers?: FieldPolicy<any> | FieldReadFunction<any>,
	mimeType?: FieldPolicy<any> | FieldReadFunction<any>,
	target?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SettingsTypeKeySpecifier = ('authMode' | 'authPassword' | 'authUsername' | 'autoBackupIncludeCategories' | 'autoBackupIncludeChapters' | 'autoBackupIncludeClientData' | 'autoBackupIncludeHistory' | 'autoBackupIncludeManga' | 'autoBackupIncludeServerSettings' | 'autoBackupIncludeTracking' | 'autoDownloadAheadLimit' | 'autoDownloadIgnoreReUploads' | 'autoDownloadNewChapters' | 'autoDownloadNewChaptersLimit' | 'backupInterval' | 'backupPath' | 'backupTTL' | 'backupTime' | 'basicAuthEnabled' | 'basicAuthPassword' | 'basicAuthUsername' | 'databasePassword' | 'databaseType' | 'databaseUrl' | 'databaseUsername' | 'debugLogsEnabled' | 'downloadAsCbz' | 'downloadConversions' | 'downloadsPath' | 'electronPath' | 'excludeCompleted' | 'excludeEntryWithUnreadChapters' | 'excludeNotStarted' | 'excludeUnreadChapters' | 'extensionRepos' | 'flareSolverrAsResponseFallback' | 'flareSolverrEnabled' | 'flareSolverrSessionName' | 'flareSolverrSessionTtl' | 'flareSolverrTimeout' | 'flareSolverrUrl' | 'globalUpdateInterval' | 'gqlDebugLogsEnabled' | 'initialOpenInBrowserEnabled' | 'ip' | 'jwtAudience' | 'jwtRefreshExpiry' | 'jwtTokenExpiry' | 'koreaderSyncChecksumMethod' | 'koreaderSyncDeviceId' | 'koreaderSyncPercentageTolerance' | 'koreaderSyncServerUrl' | 'koreaderSyncStrategy' | 'koreaderSyncStrategyBackward' | 'koreaderSyncStrategyForward' | 'koreaderSyncUserkey' | 'koreaderSyncUsername' | 'localSourcePath' | 'maxLogFileSize' | 'maxLogFiles' | 'maxLogFolderSize' | 'maxSourcesInParallel' | 'opdsCbzMimetype' | 'opdsChapterSortOrder' | 'opdsEnablePageReadProgress' | 'opdsItemsPerPage' | 'opdsMarkAsReadOnDownload' | 'opdsShowOnlyDownloadedChapters' | 'opdsShowOnlyUnreadChapters' | 'opdsUseBinaryFileSizes' | 'port' | 'serveConversions' | 'socksProxyEnabled' | 'socksProxyHost' | 'socksProxyPassword' | 'socksProxyPort' | 'socksProxyUsername' | 'socksProxyVersion' | 'systemTrayEnabled' | 'updateMangas' | 'useHikariConnectionPool' | 'webUIChannel' | 'webUIFlavor' | 'webUIInterface' | 'webUIUpdateCheckInterval' | SettingsTypeKeySpecifier)[];
export type SettingsTypeFieldPolicy = {
	authMode?: FieldPolicy<any> | FieldReadFunction<any>,
	authPassword?: FieldPolicy<any> | FieldReadFunction<any>,
	authUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeCategories?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeClientData?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeHistory?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeManga?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeServerSettings?: FieldPolicy<any> | FieldReadFunction<any>,
	autoBackupIncludeTracking?: FieldPolicy<any> | FieldReadFunction<any>,
	autoDownloadAheadLimit?: FieldPolicy<any> | FieldReadFunction<any>,
	autoDownloadIgnoreReUploads?: FieldPolicy<any> | FieldReadFunction<any>,
	autoDownloadNewChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	autoDownloadNewChaptersLimit?: FieldPolicy<any> | FieldReadFunction<any>,
	backupInterval?: FieldPolicy<any> | FieldReadFunction<any>,
	backupPath?: FieldPolicy<any> | FieldReadFunction<any>,
	backupTTL?: FieldPolicy<any> | FieldReadFunction<any>,
	backupTime?: FieldPolicy<any> | FieldReadFunction<any>,
	basicAuthEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	basicAuthPassword?: FieldPolicy<any> | FieldReadFunction<any>,
	basicAuthUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	databasePassword?: FieldPolicy<any> | FieldReadFunction<any>,
	databaseType?: FieldPolicy<any> | FieldReadFunction<any>,
	databaseUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	databaseUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	debugLogsEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadAsCbz?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadConversions?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadsPath?: FieldPolicy<any> | FieldReadFunction<any>,
	electronPath?: FieldPolicy<any> | FieldReadFunction<any>,
	excludeCompleted?: FieldPolicy<any> | FieldReadFunction<any>,
	excludeEntryWithUnreadChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	excludeNotStarted?: FieldPolicy<any> | FieldReadFunction<any>,
	excludeUnreadChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	extensionRepos?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrAsResponseFallback?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrSessionName?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrSessionTtl?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrTimeout?: FieldPolicy<any> | FieldReadFunction<any>,
	flareSolverrUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	globalUpdateInterval?: FieldPolicy<any> | FieldReadFunction<any>,
	gqlDebugLogsEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	initialOpenInBrowserEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	ip?: FieldPolicy<any> | FieldReadFunction<any>,
	jwtAudience?: FieldPolicy<any> | FieldReadFunction<any>,
	jwtRefreshExpiry?: FieldPolicy<any> | FieldReadFunction<any>,
	jwtTokenExpiry?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncChecksumMethod?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncDeviceId?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncPercentageTolerance?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncServerUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncStrategy?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncStrategyBackward?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncStrategyForward?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncUserkey?: FieldPolicy<any> | FieldReadFunction<any>,
	koreaderSyncUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	localSourcePath?: FieldPolicy<any> | FieldReadFunction<any>,
	maxLogFileSize?: FieldPolicy<any> | FieldReadFunction<any>,
	maxLogFiles?: FieldPolicy<any> | FieldReadFunction<any>,
	maxLogFolderSize?: FieldPolicy<any> | FieldReadFunction<any>,
	maxSourcesInParallel?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsCbzMimetype?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsChapterSortOrder?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsEnablePageReadProgress?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsItemsPerPage?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsMarkAsReadOnDownload?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsShowOnlyDownloadedChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsShowOnlyUnreadChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	opdsUseBinaryFileSizes?: FieldPolicy<any> | FieldReadFunction<any>,
	port?: FieldPolicy<any> | FieldReadFunction<any>,
	serveConversions?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyHost?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyPassword?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyPort?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyUsername?: FieldPolicy<any> | FieldReadFunction<any>,
	socksProxyVersion?: FieldPolicy<any> | FieldReadFunction<any>,
	systemTrayEnabled?: FieldPolicy<any> | FieldReadFunction<any>,
	updateMangas?: FieldPolicy<any> | FieldReadFunction<any>,
	useHikariConnectionPool?: FieldPolicy<any> | FieldReadFunction<any>,
	webUIChannel?: FieldPolicy<any> | FieldReadFunction<any>,
	webUIFlavor?: FieldPolicy<any> | FieldReadFunction<any>,
	webUIInterface?: FieldPolicy<any> | FieldReadFunction<any>,
	webUIUpdateCheckInterval?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SortFilterKeySpecifier = ('default' | 'name' | 'values' | SortFilterKeySpecifier)[];
export type SortFilterFieldPolicy = {
	default?: FieldPolicy<any> | FieldReadFunction<any>,
	name?: FieldPolicy<any> | FieldReadFunction<any>,
	values?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SortSelectionKeySpecifier = ('ascending' | 'index' | SortSelectionKeySpecifier)[];
export type SortSelectionFieldPolicy = {
	ascending?: FieldPolicy<any> | FieldReadFunction<any>,
	index?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SourceEdgeKeySpecifier = ('cursor' | 'node' | SourceEdgeKeySpecifier)[];
export type SourceEdgeFieldPolicy = {
	cursor?: FieldPolicy<any> | FieldReadFunction<any>,
	node?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SourceMetaTypeKeySpecifier = ('key' | 'source' | 'sourceId' | 'value' | SourceMetaTypeKeySpecifier)[];
export type SourceMetaTypeFieldPolicy = {
	key?: FieldPolicy<any> | FieldReadFunction<any>,
	source?: FieldPolicy<any> | FieldReadFunction<any>,
	sourceId?: FieldPolicy<any> | FieldReadFunction<any>,
	value?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SourceNodeListKeySpecifier = ('edges' | 'nodes' | 'pageInfo' | 'totalCount' | SourceNodeListKeySpecifier)[];
export type SourceNodeListFieldPolicy = {
	edges?: FieldPolicy<any> | FieldReadFunction<any>,
	nodes?: FieldPolicy<any> | FieldReadFunction<any>,
	pageInfo?: FieldPolicy<any> | FieldReadFunction<any>,
	totalCount?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SourceTypeKeySpecifier = ('baseUrl' | 'displayName' | 'extension' | 'filters' | 'iconUrl' | 'id' | 'isConfigurable' | 'isNsfw' | 'lang' | 'manga' | 'meta' | 'name' | 'preferences' | 'supportsLatest' | SourceTypeKeySpecifier)[];
export type SourceTypeFieldPolicy = {
	baseUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	displayName?: FieldPolicy<any> | FieldReadFunction<any>,
	extension?: FieldPolicy<any> | FieldReadFunction<any>,
	filters?: FieldPolicy<any> | FieldReadFunction<any>,
	iconUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	id?: FieldPolicy<any> | FieldReadFunction<any>,
	isConfigurable?: FieldPolicy<any> | FieldReadFunction<any>,
	isNsfw?: FieldPolicy<any> | FieldReadFunction<any>,
	lang?: FieldPolicy<any> | FieldReadFunction<any>,
	manga?: FieldPolicy<any> | FieldReadFunction<any>,
	meta?: FieldPolicy<any> | FieldReadFunction<any>,
	name?: FieldPolicy<any> | FieldReadFunction<any>,
	preferences?: FieldPolicy<any> | FieldReadFunction<any>,
	supportsLatest?: FieldPolicy<any> | FieldReadFunction<any>
};
export type StartDownloaderPayloadKeySpecifier = ('clientMutationId' | 'downloadStatus' | StartDownloaderPayloadKeySpecifier)[];
export type StartDownloaderPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadStatus?: FieldPolicy<any> | FieldReadFunction<any>
};
export type StopDownloaderPayloadKeySpecifier = ('clientMutationId' | 'downloadStatus' | StopDownloaderPayloadKeySpecifier)[];
export type StopDownloaderPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadStatus?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SubscriptionKeySpecifier = ('downloadChanged' | 'downloadStatusChanged' | 'libraryUpdateStatusChanged' | 'updateStatusChanged' | 'webUIUpdateStatusChange' | SubscriptionKeySpecifier)[];
export type SubscriptionFieldPolicy = {
	downloadChanged?: FieldPolicy<any> | FieldReadFunction<any>,
	downloadStatusChanged?: FieldPolicy<any> | FieldReadFunction<any>,
	libraryUpdateStatusChanged?: FieldPolicy<any> | FieldReadFunction<any>,
	updateStatusChanged?: FieldPolicy<any> | FieldReadFunction<any>,
	webUIUpdateStatusChange?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SwitchPreferenceKeySpecifier = ('currentValue' | 'default' | 'enabled' | 'key' | 'summary' | 'title' | 'visible' | SwitchPreferenceKeySpecifier)[];
export type SwitchPreferenceFieldPolicy = {
	currentValue?: FieldPolicy<any> | FieldReadFunction<any>,
	default?: FieldPolicy<any> | FieldReadFunction<any>,
	enabled?: FieldPolicy<any> | FieldReadFunction<any>,
	key?: FieldPolicy<any> | FieldReadFunction<any>,
	summary?: FieldPolicy<any> | FieldReadFunction<any>,
	title?: FieldPolicy<any> | FieldReadFunction<any>,
	visible?: FieldPolicy<any> | FieldReadFunction<any>
};
export type SyncConflictInfoTypeKeySpecifier = ('deviceName' | 'remotePage' | SyncConflictInfoTypeKeySpecifier)[];
export type SyncConflictInfoTypeFieldPolicy = {
	deviceName?: FieldPolicy<any> | FieldReadFunction<any>,
	remotePage?: FieldPolicy<any> | FieldReadFunction<any>
};
export type TextFilterKeySpecifier = ('default' | 'name' | TextFilterKeySpecifier)[];
export type TextFilterFieldPolicy = {
	default?: FieldPolicy<any> | FieldReadFunction<any>,
	name?: FieldPolicy<any> | FieldReadFunction<any>
};
export type TrackProgressPayloadKeySpecifier = ('clientMutationId' | 'trackRecords' | TrackProgressPayloadKeySpecifier)[];
export type TrackProgressPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	trackRecords?: FieldPolicy<any> | FieldReadFunction<any>
};
export type TrackRecordEdgeKeySpecifier = ('cursor' | 'node' | TrackRecordEdgeKeySpecifier)[];
export type TrackRecordEdgeFieldPolicy = {
	cursor?: FieldPolicy<any> | FieldReadFunction<any>,
	node?: FieldPolicy<any> | FieldReadFunction<any>
};
export type TrackRecordNodeListKeySpecifier = ('edges' | 'nodes' | 'pageInfo' | 'totalCount' | TrackRecordNodeListKeySpecifier)[];
export type TrackRecordNodeListFieldPolicy = {
	edges?: FieldPolicy<any> | FieldReadFunction<any>,
	nodes?: FieldPolicy<any> | FieldReadFunction<any>,
	pageInfo?: FieldPolicy<any> | FieldReadFunction<any>,
	totalCount?: FieldPolicy<any> | FieldReadFunction<any>
};
export type TrackRecordTypeKeySpecifier = ('displayScore' | 'finishDate' | 'id' | 'lastChapterRead' | 'libraryId' | 'manga' | 'mangaId' | 'private' | 'remoteId' | 'remoteUrl' | 'score' | 'startDate' | 'status' | 'title' | 'totalChapters' | 'tracker' | 'trackerId' | TrackRecordTypeKeySpecifier)[];
export type TrackRecordTypeFieldPolicy = {
	displayScore?: FieldPolicy<any> | FieldReadFunction<any>,
	finishDate?: FieldPolicy<any> | FieldReadFunction<any>,
	id?: FieldPolicy<any> | FieldReadFunction<any>,
	lastChapterRead?: FieldPolicy<any> | FieldReadFunction<any>,
	libraryId?: FieldPolicy<any> | FieldReadFunction<any>,
	manga?: FieldPolicy<any> | FieldReadFunction<any>,
	mangaId?: FieldPolicy<any> | FieldReadFunction<any>,
	private?: FieldPolicy<any> | FieldReadFunction<any>,
	remoteId?: FieldPolicy<any> | FieldReadFunction<any>,
	remoteUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	score?: FieldPolicy<any> | FieldReadFunction<any>,
	startDate?: FieldPolicy<any> | FieldReadFunction<any>,
	status?: FieldPolicy<any> | FieldReadFunction<any>,
	title?: FieldPolicy<any> | FieldReadFunction<any>,
	totalChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	tracker?: FieldPolicy<any> | FieldReadFunction<any>,
	trackerId?: FieldPolicy<any> | FieldReadFunction<any>
};
export type TrackSearchTypeKeySpecifier = ('coverUrl' | 'displayScore' | 'finishedReadingDate' | 'id' | 'lastChapterRead' | 'libraryId' | 'private' | 'publishingStatus' | 'publishingType' | 'remoteId' | 'score' | 'startDate' | 'startedReadingDate' | 'status' | 'summary' | 'title' | 'totalChapters' | 'tracker' | 'trackerId' | 'trackingUrl' | TrackSearchTypeKeySpecifier)[];
export type TrackSearchTypeFieldPolicy = {
	coverUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	displayScore?: FieldPolicy<any> | FieldReadFunction<any>,
	finishedReadingDate?: FieldPolicy<any> | FieldReadFunction<any>,
	id?: FieldPolicy<any> | FieldReadFunction<any>,
	lastChapterRead?: FieldPolicy<any> | FieldReadFunction<any>,
	libraryId?: FieldPolicy<any> | FieldReadFunction<any>,
	private?: FieldPolicy<any> | FieldReadFunction<any>,
	publishingStatus?: FieldPolicy<any> | FieldReadFunction<any>,
	publishingType?: FieldPolicy<any> | FieldReadFunction<any>,
	remoteId?: FieldPolicy<any> | FieldReadFunction<any>,
	score?: FieldPolicy<any> | FieldReadFunction<any>,
	startDate?: FieldPolicy<any> | FieldReadFunction<any>,
	startedReadingDate?: FieldPolicy<any> | FieldReadFunction<any>,
	status?: FieldPolicy<any> | FieldReadFunction<any>,
	summary?: FieldPolicy<any> | FieldReadFunction<any>,
	title?: FieldPolicy<any> | FieldReadFunction<any>,
	totalChapters?: FieldPolicy<any> | FieldReadFunction<any>,
	tracker?: FieldPolicy<any> | FieldReadFunction<any>,
	trackerId?: FieldPolicy<any> | FieldReadFunction<any>,
	trackingUrl?: FieldPolicy<any> | FieldReadFunction<any>
};
export type TrackStatusTypeKeySpecifier = ('name' | 'value' | TrackStatusTypeKeySpecifier)[];
export type TrackStatusTypeFieldPolicy = {
	name?: FieldPolicy<any> | FieldReadFunction<any>,
	value?: FieldPolicy<any> | FieldReadFunction<any>
};
export type TrackerEdgeKeySpecifier = ('cursor' | 'node' | TrackerEdgeKeySpecifier)[];
export type TrackerEdgeFieldPolicy = {
	cursor?: FieldPolicy<any> | FieldReadFunction<any>,
	node?: FieldPolicy<any> | FieldReadFunction<any>
};
export type TrackerNodeListKeySpecifier = ('edges' | 'nodes' | 'pageInfo' | 'totalCount' | TrackerNodeListKeySpecifier)[];
export type TrackerNodeListFieldPolicy = {
	edges?: FieldPolicy<any> | FieldReadFunction<any>,
	nodes?: FieldPolicy<any> | FieldReadFunction<any>,
	pageInfo?: FieldPolicy<any> | FieldReadFunction<any>,
	totalCount?: FieldPolicy<any> | FieldReadFunction<any>
};
export type TrackerTypeKeySpecifier = ('authUrl' | 'icon' | 'id' | 'isLoggedIn' | 'isTokenExpired' | 'name' | 'scores' | 'statuses' | 'supportsPrivateTracking' | 'supportsReadingDates' | 'supportsTrackDeletion' | 'trackRecords' | TrackerTypeKeySpecifier)[];
export type TrackerTypeFieldPolicy = {
	authUrl?: FieldPolicy<any> | FieldReadFunction<any>,
	icon?: FieldPolicy<any> | FieldReadFunction<any>,
	id?: FieldPolicy<any> | FieldReadFunction<any>,
	isLoggedIn?: FieldPolicy<any> | FieldReadFunction<any>,
	isTokenExpired?: FieldPolicy<any> | FieldReadFunction<any>,
	name?: FieldPolicy<any> | FieldReadFunction<any>,
	scores?: FieldPolicy<any> | FieldReadFunction<any>,
	statuses?: FieldPolicy<any> | FieldReadFunction<any>,
	supportsPrivateTracking?: FieldPolicy<any> | FieldReadFunction<any>,
	supportsReadingDates?: FieldPolicy<any> | FieldReadFunction<any>,
	supportsTrackDeletion?: FieldPolicy<any> | FieldReadFunction<any>,
	trackRecords?: FieldPolicy<any> | FieldReadFunction<any>
};
export type TriStateFilterKeySpecifier = ('default' | 'name' | TriStateFilterKeySpecifier)[];
export type TriStateFilterFieldPolicy = {
	default?: FieldPolicy<any> | FieldReadFunction<any>,
	name?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UnbindTrackPayloadKeySpecifier = ('clientMutationId' | 'trackRecord' | UnbindTrackPayloadKeySpecifier)[];
export type UnbindTrackPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	trackRecord?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateCategoriesPayloadKeySpecifier = ('categories' | 'clientMutationId' | UpdateCategoriesPayloadKeySpecifier)[];
export type UpdateCategoriesPayloadFieldPolicy = {
	categories?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateCategoryMangaPayloadKeySpecifier = ('clientMutationId' | 'updateStatus' | UpdateCategoryMangaPayloadKeySpecifier)[];
export type UpdateCategoryMangaPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	updateStatus?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateCategoryOrderPayloadKeySpecifier = ('categories' | 'clientMutationId' | UpdateCategoryOrderPayloadKeySpecifier)[];
export type UpdateCategoryOrderPayloadFieldPolicy = {
	categories?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateCategoryPayloadKeySpecifier = ('category' | 'clientMutationId' | UpdateCategoryPayloadKeySpecifier)[];
export type UpdateCategoryPayloadFieldPolicy = {
	category?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateChapterPayloadKeySpecifier = ('chapter' | 'clientMutationId' | UpdateChapterPayloadKeySpecifier)[];
export type UpdateChapterPayloadFieldPolicy = {
	chapter?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateChaptersPayloadKeySpecifier = ('chapters' | 'clientMutationId' | UpdateChaptersPayloadKeySpecifier)[];
export type UpdateChaptersPayloadFieldPolicy = {
	chapters?: FieldPolicy<any> | FieldReadFunction<any>,
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateExtensionPayloadKeySpecifier = ('clientMutationId' | 'extension' | UpdateExtensionPayloadKeySpecifier)[];
export type UpdateExtensionPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	extension?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateExtensionsPayloadKeySpecifier = ('clientMutationId' | 'extensions' | UpdateExtensionsPayloadKeySpecifier)[];
export type UpdateExtensionsPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	extensions?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateLibraryMangaPayloadKeySpecifier = ('clientMutationId' | 'updateStatus' | UpdateLibraryMangaPayloadKeySpecifier)[];
export type UpdateLibraryMangaPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	updateStatus?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateLibraryPayloadKeySpecifier = ('clientMutationId' | 'updateStatus' | UpdateLibraryPayloadKeySpecifier)[];
export type UpdateLibraryPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	updateStatus?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateMangaCategoriesPayloadKeySpecifier = ('clientMutationId' | 'manga' | UpdateMangaCategoriesPayloadKeySpecifier)[];
export type UpdateMangaCategoriesPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	manga?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateMangaPayloadKeySpecifier = ('clientMutationId' | 'manga' | UpdateMangaPayloadKeySpecifier)[];
export type UpdateMangaPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	manga?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateMangasCategoriesPayloadKeySpecifier = ('clientMutationId' | 'mangas' | UpdateMangasCategoriesPayloadKeySpecifier)[];
export type UpdateMangasCategoriesPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	mangas?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateMangasPayloadKeySpecifier = ('clientMutationId' | 'mangas' | UpdateMangasPayloadKeySpecifier)[];
export type UpdateMangasPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	mangas?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateSourcePreferencePayloadKeySpecifier = ('clientMutationId' | 'preferences' | 'source' | UpdateSourcePreferencePayloadKeySpecifier)[];
export type UpdateSourcePreferencePayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	preferences?: FieldPolicy<any> | FieldReadFunction<any>,
	source?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateStatusKeySpecifier = ('completeJobs' | 'failedJobs' | 'isRunning' | 'pendingJobs' | 'runningJobs' | 'skippedCategories' | 'skippedJobs' | 'updatingCategories' | UpdateStatusKeySpecifier)[];
export type UpdateStatusFieldPolicy = {
	completeJobs?: FieldPolicy<any> | FieldReadFunction<any>,
	failedJobs?: FieldPolicy<any> | FieldReadFunction<any>,
	isRunning?: FieldPolicy<any> | FieldReadFunction<any>,
	pendingJobs?: FieldPolicy<any> | FieldReadFunction<any>,
	runningJobs?: FieldPolicy<any> | FieldReadFunction<any>,
	skippedCategories?: FieldPolicy<any> | FieldReadFunction<any>,
	skippedJobs?: FieldPolicy<any> | FieldReadFunction<any>,
	updatingCategories?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateStatusCategoryTypeKeySpecifier = ('categories' | UpdateStatusCategoryTypeKeySpecifier)[];
export type UpdateStatusCategoryTypeFieldPolicy = {
	categories?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateStatusTypeKeySpecifier = ('mangas' | UpdateStatusTypeKeySpecifier)[];
export type UpdateStatusTypeFieldPolicy = {
	mangas?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateStopPayloadKeySpecifier = ('clientMutationId' | UpdateStopPayloadKeySpecifier)[];
export type UpdateStopPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdateTrackPayloadKeySpecifier = ('clientMutationId' | 'trackRecord' | UpdateTrackPayloadKeySpecifier)[];
export type UpdateTrackPayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	trackRecord?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdaterJobsInfoTypeKeySpecifier = ('finishedJobs' | 'isRunning' | 'skippedCategoriesCount' | 'skippedMangasCount' | 'totalJobs' | UpdaterJobsInfoTypeKeySpecifier)[];
export type UpdaterJobsInfoTypeFieldPolicy = {
	finishedJobs?: FieldPolicy<any> | FieldReadFunction<any>,
	isRunning?: FieldPolicy<any> | FieldReadFunction<any>,
	skippedCategoriesCount?: FieldPolicy<any> | FieldReadFunction<any>,
	skippedMangasCount?: FieldPolicy<any> | FieldReadFunction<any>,
	totalJobs?: FieldPolicy<any> | FieldReadFunction<any>
};
export type UpdaterUpdatesKeySpecifier = ('categoryUpdates' | 'initial' | 'jobsInfo' | 'mangaUpdates' | 'omittedUpdates' | UpdaterUpdatesKeySpecifier)[];
export type UpdaterUpdatesFieldPolicy = {
	categoryUpdates?: FieldPolicy<any> | FieldReadFunction<any>,
	initial?: FieldPolicy<any> | FieldReadFunction<any>,
	jobsInfo?: FieldPolicy<any> | FieldReadFunction<any>,
	mangaUpdates?: FieldPolicy<any> | FieldReadFunction<any>,
	omittedUpdates?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ValidateBackupResultKeySpecifier = ('missingSources' | 'missingTrackers' | ValidateBackupResultKeySpecifier)[];
export type ValidateBackupResultFieldPolicy = {
	missingSources?: FieldPolicy<any> | FieldReadFunction<any>,
	missingTrackers?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ValidateBackupSourceKeySpecifier = ('id' | 'name' | ValidateBackupSourceKeySpecifier)[];
export type ValidateBackupSourceFieldPolicy = {
	id?: FieldPolicy<any> | FieldReadFunction<any>,
	name?: FieldPolicy<any> | FieldReadFunction<any>
};
export type ValidateBackupTrackerKeySpecifier = ('name' | ValidateBackupTrackerKeySpecifier)[];
export type ValidateBackupTrackerFieldPolicy = {
	name?: FieldPolicy<any> | FieldReadFunction<any>
};
export type WebUIUpdateCheckKeySpecifier = ('channel' | 'tag' | 'updateAvailable' | WebUIUpdateCheckKeySpecifier)[];
export type WebUIUpdateCheckFieldPolicy = {
	channel?: FieldPolicy<any> | FieldReadFunction<any>,
	tag?: FieldPolicy<any> | FieldReadFunction<any>,
	updateAvailable?: FieldPolicy<any> | FieldReadFunction<any>
};
export type WebUIUpdateInfoKeySpecifier = ('channel' | 'tag' | WebUIUpdateInfoKeySpecifier)[];
export type WebUIUpdateInfoFieldPolicy = {
	channel?: FieldPolicy<any> | FieldReadFunction<any>,
	tag?: FieldPolicy<any> | FieldReadFunction<any>
};
export type WebUIUpdatePayloadKeySpecifier = ('clientMutationId' | 'updateStatus' | WebUIUpdatePayloadKeySpecifier)[];
export type WebUIUpdatePayloadFieldPolicy = {
	clientMutationId?: FieldPolicy<any> | FieldReadFunction<any>,
	updateStatus?: FieldPolicy<any> | FieldReadFunction<any>
};
export type WebUIUpdateStatusKeySpecifier = ('info' | 'progress' | 'state' | WebUIUpdateStatusKeySpecifier)[];
export type WebUIUpdateStatusFieldPolicy = {
	info?: FieldPolicy<any> | FieldReadFunction<any>,
	progress?: FieldPolicy<any> | FieldReadFunction<any>,
	state?: FieldPolicy<any> | FieldReadFunction<any>
};
export type StrictTypedTypePolicies = {
	AboutServerPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | AboutServerPayloadKeySpecifier | (() => undefined | AboutServerPayloadKeySpecifier),
		fields?: AboutServerPayloadFieldPolicy,
	},
	AboutWebUI?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | AboutWebUIKeySpecifier | (() => undefined | AboutWebUIKeySpecifier),
		fields?: AboutWebUIFieldPolicy,
	},
	BackupRestoreStatus?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | BackupRestoreStatusKeySpecifier | (() => undefined | BackupRestoreStatusKeySpecifier),
		fields?: BackupRestoreStatusFieldPolicy,
	},
	BindTrackPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | BindTrackPayloadKeySpecifier | (() => undefined | BindTrackPayloadKeySpecifier),
		fields?: BindTrackPayloadFieldPolicy,
	},
	CategoryEdge?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | CategoryEdgeKeySpecifier | (() => undefined | CategoryEdgeKeySpecifier),
		fields?: CategoryEdgeFieldPolicy,
	},
	CategoryMetaType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | CategoryMetaTypeKeySpecifier | (() => undefined | CategoryMetaTypeKeySpecifier),
		fields?: CategoryMetaTypeFieldPolicy,
	},
	CategoryNodeList?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | CategoryNodeListKeySpecifier | (() => undefined | CategoryNodeListKeySpecifier),
		fields?: CategoryNodeListFieldPolicy,
	},
	CategoryType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | CategoryTypeKeySpecifier | (() => undefined | CategoryTypeKeySpecifier),
		fields?: CategoryTypeFieldPolicy,
	},
	CategoryUpdateType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | CategoryUpdateTypeKeySpecifier | (() => undefined | CategoryUpdateTypeKeySpecifier),
		fields?: CategoryUpdateTypeFieldPolicy,
	},
	ChapterEdge?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ChapterEdgeKeySpecifier | (() => undefined | ChapterEdgeKeySpecifier),
		fields?: ChapterEdgeFieldPolicy,
	},
	ChapterMetaType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ChapterMetaTypeKeySpecifier | (() => undefined | ChapterMetaTypeKeySpecifier),
		fields?: ChapterMetaTypeFieldPolicy,
	},
	ChapterNodeList?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ChapterNodeListKeySpecifier | (() => undefined | ChapterNodeListKeySpecifier),
		fields?: ChapterNodeListFieldPolicy,
	},
	ChapterType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ChapterTypeKeySpecifier | (() => undefined | ChapterTypeKeySpecifier),
		fields?: ChapterTypeFieldPolicy,
	},
	CheckBoxFilter?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | CheckBoxFilterKeySpecifier | (() => undefined | CheckBoxFilterKeySpecifier),
		fields?: CheckBoxFilterFieldPolicy,
	},
	CheckBoxPreference?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | CheckBoxPreferenceKeySpecifier | (() => undefined | CheckBoxPreferenceKeySpecifier),
		fields?: CheckBoxPreferenceFieldPolicy,
	},
	CheckForServerUpdatesPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | CheckForServerUpdatesPayloadKeySpecifier | (() => undefined | CheckForServerUpdatesPayloadKeySpecifier),
		fields?: CheckForServerUpdatesPayloadFieldPolicy,
	},
	ClearCachedImagesPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ClearCachedImagesPayloadKeySpecifier | (() => undefined | ClearCachedImagesPayloadKeySpecifier),
		fields?: ClearCachedImagesPayloadFieldPolicy,
	},
	ClearDownloaderPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ClearDownloaderPayloadKeySpecifier | (() => undefined | ClearDownloaderPayloadKeySpecifier),
		fields?: ClearDownloaderPayloadFieldPolicy,
	},
	CreateBackupPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | CreateBackupPayloadKeySpecifier | (() => undefined | CreateBackupPayloadKeySpecifier),
		fields?: CreateBackupPayloadFieldPolicy,
	},
	CreateCategoryPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | CreateCategoryPayloadKeySpecifier | (() => undefined | CreateCategoryPayloadKeySpecifier),
		fields?: CreateCategoryPayloadFieldPolicy,
	},
	DeleteCategoryMetaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DeleteCategoryMetaPayloadKeySpecifier | (() => undefined | DeleteCategoryMetaPayloadKeySpecifier),
		fields?: DeleteCategoryMetaPayloadFieldPolicy,
	},
	DeleteCategoryPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DeleteCategoryPayloadKeySpecifier | (() => undefined | DeleteCategoryPayloadKeySpecifier),
		fields?: DeleteCategoryPayloadFieldPolicy,
	},
	DeleteChapterMetaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DeleteChapterMetaPayloadKeySpecifier | (() => undefined | DeleteChapterMetaPayloadKeySpecifier),
		fields?: DeleteChapterMetaPayloadFieldPolicy,
	},
	DeleteDownloadedChapterPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DeleteDownloadedChapterPayloadKeySpecifier | (() => undefined | DeleteDownloadedChapterPayloadKeySpecifier),
		fields?: DeleteDownloadedChapterPayloadFieldPolicy,
	},
	DeleteDownloadedChaptersPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DeleteDownloadedChaptersPayloadKeySpecifier | (() => undefined | DeleteDownloadedChaptersPayloadKeySpecifier),
		fields?: DeleteDownloadedChaptersPayloadFieldPolicy,
	},
	DeleteGlobalMetaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DeleteGlobalMetaPayloadKeySpecifier | (() => undefined | DeleteGlobalMetaPayloadKeySpecifier),
		fields?: DeleteGlobalMetaPayloadFieldPolicy,
	},
	DeleteMangaMetaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DeleteMangaMetaPayloadKeySpecifier | (() => undefined | DeleteMangaMetaPayloadKeySpecifier),
		fields?: DeleteMangaMetaPayloadFieldPolicy,
	},
	DeleteSourceMetaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DeleteSourceMetaPayloadKeySpecifier | (() => undefined | DeleteSourceMetaPayloadKeySpecifier),
		fields?: DeleteSourceMetaPayloadFieldPolicy,
	},
	DequeueChapterDownloadPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DequeueChapterDownloadPayloadKeySpecifier | (() => undefined | DequeueChapterDownloadPayloadKeySpecifier),
		fields?: DequeueChapterDownloadPayloadFieldPolicy,
	},
	DequeueChapterDownloadsPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DequeueChapterDownloadsPayloadKeySpecifier | (() => undefined | DequeueChapterDownloadsPayloadKeySpecifier),
		fields?: DequeueChapterDownloadsPayloadFieldPolicy,
	},
	DownloadEdge?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DownloadEdgeKeySpecifier | (() => undefined | DownloadEdgeKeySpecifier),
		fields?: DownloadEdgeFieldPolicy,
	},
	DownloadNodeList?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DownloadNodeListKeySpecifier | (() => undefined | DownloadNodeListKeySpecifier),
		fields?: DownloadNodeListFieldPolicy,
	},
	DownloadStatus?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DownloadStatusKeySpecifier | (() => undefined | DownloadStatusKeySpecifier),
		fields?: DownloadStatusFieldPolicy,
	},
	DownloadType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DownloadTypeKeySpecifier | (() => undefined | DownloadTypeKeySpecifier),
		fields?: DownloadTypeFieldPolicy,
	},
	DownloadUpdate?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DownloadUpdateKeySpecifier | (() => undefined | DownloadUpdateKeySpecifier),
		fields?: DownloadUpdateFieldPolicy,
	},
	DownloadUpdates?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | DownloadUpdatesKeySpecifier | (() => undefined | DownloadUpdatesKeySpecifier),
		fields?: DownloadUpdatesFieldPolicy,
	},
	Edge?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | EdgeKeySpecifier | (() => undefined | EdgeKeySpecifier),
		fields?: EdgeFieldPolicy,
	},
	EditTextPreference?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | EditTextPreferenceKeySpecifier | (() => undefined | EditTextPreferenceKeySpecifier),
		fields?: EditTextPreferenceFieldPolicy,
	},
	EnqueueChapterDownloadPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | EnqueueChapterDownloadPayloadKeySpecifier | (() => undefined | EnqueueChapterDownloadPayloadKeySpecifier),
		fields?: EnqueueChapterDownloadPayloadFieldPolicy,
	},
	EnqueueChapterDownloadsPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | EnqueueChapterDownloadsPayloadKeySpecifier | (() => undefined | EnqueueChapterDownloadsPayloadKeySpecifier),
		fields?: EnqueueChapterDownloadsPayloadFieldPolicy,
	},
	ExtensionEdge?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ExtensionEdgeKeySpecifier | (() => undefined | ExtensionEdgeKeySpecifier),
		fields?: ExtensionEdgeFieldPolicy,
	},
	ExtensionNodeList?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ExtensionNodeListKeySpecifier | (() => undefined | ExtensionNodeListKeySpecifier),
		fields?: ExtensionNodeListFieldPolicy,
	},
	ExtensionType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ExtensionTypeKeySpecifier | (() => undefined | ExtensionTypeKeySpecifier),
		fields?: ExtensionTypeFieldPolicy,
	},
	FetchChapterPagesPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | FetchChapterPagesPayloadKeySpecifier | (() => undefined | FetchChapterPagesPayloadKeySpecifier),
		fields?: FetchChapterPagesPayloadFieldPolicy,
	},
	FetchChaptersPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | FetchChaptersPayloadKeySpecifier | (() => undefined | FetchChaptersPayloadKeySpecifier),
		fields?: FetchChaptersPayloadFieldPolicy,
	},
	FetchExtensionsPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | FetchExtensionsPayloadKeySpecifier | (() => undefined | FetchExtensionsPayloadKeySpecifier),
		fields?: FetchExtensionsPayloadFieldPolicy,
	},
	FetchMangaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | FetchMangaPayloadKeySpecifier | (() => undefined | FetchMangaPayloadKeySpecifier),
		fields?: FetchMangaPayloadFieldPolicy,
	},
	FetchSourceMangaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | FetchSourceMangaPayloadKeySpecifier | (() => undefined | FetchSourceMangaPayloadKeySpecifier),
		fields?: FetchSourceMangaPayloadFieldPolicy,
	},
	FetchTrackPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | FetchTrackPayloadKeySpecifier | (() => undefined | FetchTrackPayloadKeySpecifier),
		fields?: FetchTrackPayloadFieldPolicy,
	},
	GlobalMetaNodeList?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | GlobalMetaNodeListKeySpecifier | (() => undefined | GlobalMetaNodeListKeySpecifier),
		fields?: GlobalMetaNodeListFieldPolicy,
	},
	GlobalMetaType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | GlobalMetaTypeKeySpecifier | (() => undefined | GlobalMetaTypeKeySpecifier),
		fields?: GlobalMetaTypeFieldPolicy,
	},
	GroupFilter?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | GroupFilterKeySpecifier | (() => undefined | GroupFilterKeySpecifier),
		fields?: GroupFilterFieldPolicy,
	},
	HeaderFilter?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | HeaderFilterKeySpecifier | (() => undefined | HeaderFilterKeySpecifier),
		fields?: HeaderFilterFieldPolicy,
	},
	InstallExternalExtensionPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | InstallExternalExtensionPayloadKeySpecifier | (() => undefined | InstallExternalExtensionPayloadKeySpecifier),
		fields?: InstallExternalExtensionPayloadFieldPolicy,
	},
	KoSyncConnectPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | KoSyncConnectPayloadKeySpecifier | (() => undefined | KoSyncConnectPayloadKeySpecifier),
		fields?: KoSyncConnectPayloadFieldPolicy,
	},
	KoSyncStatusPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | KoSyncStatusPayloadKeySpecifier | (() => undefined | KoSyncStatusPayloadKeySpecifier),
		fields?: KoSyncStatusPayloadFieldPolicy,
	},
	LastUpdateTimestampPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | LastUpdateTimestampPayloadKeySpecifier | (() => undefined | LastUpdateTimestampPayloadKeySpecifier),
		fields?: LastUpdateTimestampPayloadFieldPolicy,
	},
	LibraryUpdateStatus?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | LibraryUpdateStatusKeySpecifier | (() => undefined | LibraryUpdateStatusKeySpecifier),
		fields?: LibraryUpdateStatusFieldPolicy,
	},
	ListPreference?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ListPreferenceKeySpecifier | (() => undefined | ListPreferenceKeySpecifier),
		fields?: ListPreferenceFieldPolicy,
	},
	LoginPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | LoginPayloadKeySpecifier | (() => undefined | LoginPayloadKeySpecifier),
		fields?: LoginPayloadFieldPolicy,
	},
	LoginTrackerCredentialsPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | LoginTrackerCredentialsPayloadKeySpecifier | (() => undefined | LoginTrackerCredentialsPayloadKeySpecifier),
		fields?: LoginTrackerCredentialsPayloadFieldPolicy,
	},
	LoginTrackerOAuthPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | LoginTrackerOAuthPayloadKeySpecifier | (() => undefined | LoginTrackerOAuthPayloadKeySpecifier),
		fields?: LoginTrackerOAuthPayloadFieldPolicy,
	},
	LogoutKoSyncAccountPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | LogoutKoSyncAccountPayloadKeySpecifier | (() => undefined | LogoutKoSyncAccountPayloadKeySpecifier),
		fields?: LogoutKoSyncAccountPayloadFieldPolicy,
	},
	LogoutTrackerPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | LogoutTrackerPayloadKeySpecifier | (() => undefined | LogoutTrackerPayloadKeySpecifier),
		fields?: LogoutTrackerPayloadFieldPolicy,
	},
	MangaEdge?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | MangaEdgeKeySpecifier | (() => undefined | MangaEdgeKeySpecifier),
		fields?: MangaEdgeFieldPolicy,
	},
	MangaMetaType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | MangaMetaTypeKeySpecifier | (() => undefined | MangaMetaTypeKeySpecifier),
		fields?: MangaMetaTypeFieldPolicy,
	},
	MangaNodeList?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | MangaNodeListKeySpecifier | (() => undefined | MangaNodeListKeySpecifier),
		fields?: MangaNodeListFieldPolicy,
	},
	MangaType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | MangaTypeKeySpecifier | (() => undefined | MangaTypeKeySpecifier),
		fields?: MangaTypeFieldPolicy,
	},
	MangaUpdateType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | MangaUpdateTypeKeySpecifier | (() => undefined | MangaUpdateTypeKeySpecifier),
		fields?: MangaUpdateTypeFieldPolicy,
	},
	MetaEdge?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | MetaEdgeKeySpecifier | (() => undefined | MetaEdgeKeySpecifier),
		fields?: MetaEdgeFieldPolicy,
	},
	MetaType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | MetaTypeKeySpecifier | (() => undefined | MetaTypeKeySpecifier),
		fields?: MetaTypeFieldPolicy,
	},
	MultiSelectListPreference?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | MultiSelectListPreferenceKeySpecifier | (() => undefined | MultiSelectListPreferenceKeySpecifier),
		fields?: MultiSelectListPreferenceFieldPolicy,
	},
	Mutation?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | MutationKeySpecifier | (() => undefined | MutationKeySpecifier),
		fields?: MutationFieldPolicy,
	},
	NodeList?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | NodeListKeySpecifier | (() => undefined | NodeListKeySpecifier),
		fields?: NodeListFieldPolicy,
	},
	PageInfo?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | PageInfoKeySpecifier | (() => undefined | PageInfoKeySpecifier),
		fields?: PageInfoFieldPolicy,
	},
	PartialSettingsType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | PartialSettingsTypeKeySpecifier | (() => undefined | PartialSettingsTypeKeySpecifier),
		fields?: PartialSettingsTypeFieldPolicy,
	},
	PullKoSyncProgressPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | PullKoSyncProgressPayloadKeySpecifier | (() => undefined | PullKoSyncProgressPayloadKeySpecifier),
		fields?: PullKoSyncProgressPayloadFieldPolicy,
	},
	PushKoSyncProgressPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | PushKoSyncProgressPayloadKeySpecifier | (() => undefined | PushKoSyncProgressPayloadKeySpecifier),
		fields?: PushKoSyncProgressPayloadFieldPolicy,
	},
	Query?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | QueryKeySpecifier | (() => undefined | QueryKeySpecifier),
		fields?: QueryFieldPolicy,
	},
	RefreshTokenPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | RefreshTokenPayloadKeySpecifier | (() => undefined | RefreshTokenPayloadKeySpecifier),
		fields?: RefreshTokenPayloadFieldPolicy,
	},
	ReorderChapterDownloadPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ReorderChapterDownloadPayloadKeySpecifier | (() => undefined | ReorderChapterDownloadPayloadKeySpecifier),
		fields?: ReorderChapterDownloadPayloadFieldPolicy,
	},
	ResetSettingsPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ResetSettingsPayloadKeySpecifier | (() => undefined | ResetSettingsPayloadKeySpecifier),
		fields?: ResetSettingsPayloadFieldPolicy,
	},
	RestoreBackupPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | RestoreBackupPayloadKeySpecifier | (() => undefined | RestoreBackupPayloadKeySpecifier),
		fields?: RestoreBackupPayloadFieldPolicy,
	},
	SearchTrackerPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SearchTrackerPayloadKeySpecifier | (() => undefined | SearchTrackerPayloadKeySpecifier),
		fields?: SearchTrackerPayloadFieldPolicy,
	},
	SelectFilter?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SelectFilterKeySpecifier | (() => undefined | SelectFilterKeySpecifier),
		fields?: SelectFilterFieldPolicy,
	},
	SeparatorFilter?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SeparatorFilterKeySpecifier | (() => undefined | SeparatorFilterKeySpecifier),
		fields?: SeparatorFilterFieldPolicy,
	},
	SetCategoryMetaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SetCategoryMetaPayloadKeySpecifier | (() => undefined | SetCategoryMetaPayloadKeySpecifier),
		fields?: SetCategoryMetaPayloadFieldPolicy,
	},
	SetChapterMetaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SetChapterMetaPayloadKeySpecifier | (() => undefined | SetChapterMetaPayloadKeySpecifier),
		fields?: SetChapterMetaPayloadFieldPolicy,
	},
	SetGlobalMetaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SetGlobalMetaPayloadKeySpecifier | (() => undefined | SetGlobalMetaPayloadKeySpecifier),
		fields?: SetGlobalMetaPayloadFieldPolicy,
	},
	SetMangaMetaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SetMangaMetaPayloadKeySpecifier | (() => undefined | SetMangaMetaPayloadKeySpecifier),
		fields?: SetMangaMetaPayloadFieldPolicy,
	},
	SetSettingsPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SetSettingsPayloadKeySpecifier | (() => undefined | SetSettingsPayloadKeySpecifier),
		fields?: SetSettingsPayloadFieldPolicy,
	},
	SetSourceMetaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SetSourceMetaPayloadKeySpecifier | (() => undefined | SetSourceMetaPayloadKeySpecifier),
		fields?: SetSourceMetaPayloadFieldPolicy,
	},
	Settings?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SettingsKeySpecifier | (() => undefined | SettingsKeySpecifier),
		fields?: SettingsFieldPolicy,
	},
	SettingsDownloadConversion?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SettingsDownloadConversionKeySpecifier | (() => undefined | SettingsDownloadConversionKeySpecifier),
		fields?: SettingsDownloadConversionFieldPolicy,
	},
	SettingsDownloadConversionHeader?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SettingsDownloadConversionHeaderKeySpecifier | (() => undefined | SettingsDownloadConversionHeaderKeySpecifier),
		fields?: SettingsDownloadConversionHeaderFieldPolicy,
	},
	SettingsDownloadConversionHeaderType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SettingsDownloadConversionHeaderTypeKeySpecifier | (() => undefined | SettingsDownloadConversionHeaderTypeKeySpecifier),
		fields?: SettingsDownloadConversionHeaderTypeFieldPolicy,
	},
	SettingsDownloadConversionType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SettingsDownloadConversionTypeKeySpecifier | (() => undefined | SettingsDownloadConversionTypeKeySpecifier),
		fields?: SettingsDownloadConversionTypeFieldPolicy,
	},
	SettingsType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SettingsTypeKeySpecifier | (() => undefined | SettingsTypeKeySpecifier),
		fields?: SettingsTypeFieldPolicy,
	},
	SortFilter?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SortFilterKeySpecifier | (() => undefined | SortFilterKeySpecifier),
		fields?: SortFilterFieldPolicy,
	},
	SortSelection?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SortSelectionKeySpecifier | (() => undefined | SortSelectionKeySpecifier),
		fields?: SortSelectionFieldPolicy,
	},
	SourceEdge?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SourceEdgeKeySpecifier | (() => undefined | SourceEdgeKeySpecifier),
		fields?: SourceEdgeFieldPolicy,
	},
	SourceMetaType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SourceMetaTypeKeySpecifier | (() => undefined | SourceMetaTypeKeySpecifier),
		fields?: SourceMetaTypeFieldPolicy,
	},
	SourceNodeList?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SourceNodeListKeySpecifier | (() => undefined | SourceNodeListKeySpecifier),
		fields?: SourceNodeListFieldPolicy,
	},
	SourceType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SourceTypeKeySpecifier | (() => undefined | SourceTypeKeySpecifier),
		fields?: SourceTypeFieldPolicy,
	},
	StartDownloaderPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | StartDownloaderPayloadKeySpecifier | (() => undefined | StartDownloaderPayloadKeySpecifier),
		fields?: StartDownloaderPayloadFieldPolicy,
	},
	StopDownloaderPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | StopDownloaderPayloadKeySpecifier | (() => undefined | StopDownloaderPayloadKeySpecifier),
		fields?: StopDownloaderPayloadFieldPolicy,
	},
	Subscription?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SubscriptionKeySpecifier | (() => undefined | SubscriptionKeySpecifier),
		fields?: SubscriptionFieldPolicy,
	},
	SwitchPreference?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SwitchPreferenceKeySpecifier | (() => undefined | SwitchPreferenceKeySpecifier),
		fields?: SwitchPreferenceFieldPolicy,
	},
	SyncConflictInfoType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | SyncConflictInfoTypeKeySpecifier | (() => undefined | SyncConflictInfoTypeKeySpecifier),
		fields?: SyncConflictInfoTypeFieldPolicy,
	},
	TextFilter?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | TextFilterKeySpecifier | (() => undefined | TextFilterKeySpecifier),
		fields?: TextFilterFieldPolicy,
	},
	TrackProgressPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | TrackProgressPayloadKeySpecifier | (() => undefined | TrackProgressPayloadKeySpecifier),
		fields?: TrackProgressPayloadFieldPolicy,
	},
	TrackRecordEdge?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | TrackRecordEdgeKeySpecifier | (() => undefined | TrackRecordEdgeKeySpecifier),
		fields?: TrackRecordEdgeFieldPolicy,
	},
	TrackRecordNodeList?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | TrackRecordNodeListKeySpecifier | (() => undefined | TrackRecordNodeListKeySpecifier),
		fields?: TrackRecordNodeListFieldPolicy,
	},
	TrackRecordType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | TrackRecordTypeKeySpecifier | (() => undefined | TrackRecordTypeKeySpecifier),
		fields?: TrackRecordTypeFieldPolicy,
	},
	TrackSearchType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | TrackSearchTypeKeySpecifier | (() => undefined | TrackSearchTypeKeySpecifier),
		fields?: TrackSearchTypeFieldPolicy,
	},
	TrackStatusType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | TrackStatusTypeKeySpecifier | (() => undefined | TrackStatusTypeKeySpecifier),
		fields?: TrackStatusTypeFieldPolicy,
	},
	TrackerEdge?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | TrackerEdgeKeySpecifier | (() => undefined | TrackerEdgeKeySpecifier),
		fields?: TrackerEdgeFieldPolicy,
	},
	TrackerNodeList?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | TrackerNodeListKeySpecifier | (() => undefined | TrackerNodeListKeySpecifier),
		fields?: TrackerNodeListFieldPolicy,
	},
	TrackerType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | TrackerTypeKeySpecifier | (() => undefined | TrackerTypeKeySpecifier),
		fields?: TrackerTypeFieldPolicy,
	},
	TriStateFilter?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | TriStateFilterKeySpecifier | (() => undefined | TriStateFilterKeySpecifier),
		fields?: TriStateFilterFieldPolicy,
	},
	UnbindTrackPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UnbindTrackPayloadKeySpecifier | (() => undefined | UnbindTrackPayloadKeySpecifier),
		fields?: UnbindTrackPayloadFieldPolicy,
	},
	UpdateCategoriesPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateCategoriesPayloadKeySpecifier | (() => undefined | UpdateCategoriesPayloadKeySpecifier),
		fields?: UpdateCategoriesPayloadFieldPolicy,
	},
	UpdateCategoryMangaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateCategoryMangaPayloadKeySpecifier | (() => undefined | UpdateCategoryMangaPayloadKeySpecifier),
		fields?: UpdateCategoryMangaPayloadFieldPolicy,
	},
	UpdateCategoryOrderPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateCategoryOrderPayloadKeySpecifier | (() => undefined | UpdateCategoryOrderPayloadKeySpecifier),
		fields?: UpdateCategoryOrderPayloadFieldPolicy,
	},
	UpdateCategoryPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateCategoryPayloadKeySpecifier | (() => undefined | UpdateCategoryPayloadKeySpecifier),
		fields?: UpdateCategoryPayloadFieldPolicy,
	},
	UpdateChapterPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateChapterPayloadKeySpecifier | (() => undefined | UpdateChapterPayloadKeySpecifier),
		fields?: UpdateChapterPayloadFieldPolicy,
	},
	UpdateChaptersPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateChaptersPayloadKeySpecifier | (() => undefined | UpdateChaptersPayloadKeySpecifier),
		fields?: UpdateChaptersPayloadFieldPolicy,
	},
	UpdateExtensionPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateExtensionPayloadKeySpecifier | (() => undefined | UpdateExtensionPayloadKeySpecifier),
		fields?: UpdateExtensionPayloadFieldPolicy,
	},
	UpdateExtensionsPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateExtensionsPayloadKeySpecifier | (() => undefined | UpdateExtensionsPayloadKeySpecifier),
		fields?: UpdateExtensionsPayloadFieldPolicy,
	},
	UpdateLibraryMangaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateLibraryMangaPayloadKeySpecifier | (() => undefined | UpdateLibraryMangaPayloadKeySpecifier),
		fields?: UpdateLibraryMangaPayloadFieldPolicy,
	},
	UpdateLibraryPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateLibraryPayloadKeySpecifier | (() => undefined | UpdateLibraryPayloadKeySpecifier),
		fields?: UpdateLibraryPayloadFieldPolicy,
	},
	UpdateMangaCategoriesPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateMangaCategoriesPayloadKeySpecifier | (() => undefined | UpdateMangaCategoriesPayloadKeySpecifier),
		fields?: UpdateMangaCategoriesPayloadFieldPolicy,
	},
	UpdateMangaPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateMangaPayloadKeySpecifier | (() => undefined | UpdateMangaPayloadKeySpecifier),
		fields?: UpdateMangaPayloadFieldPolicy,
	},
	UpdateMangasCategoriesPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateMangasCategoriesPayloadKeySpecifier | (() => undefined | UpdateMangasCategoriesPayloadKeySpecifier),
		fields?: UpdateMangasCategoriesPayloadFieldPolicy,
	},
	UpdateMangasPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateMangasPayloadKeySpecifier | (() => undefined | UpdateMangasPayloadKeySpecifier),
		fields?: UpdateMangasPayloadFieldPolicy,
	},
	UpdateSourcePreferencePayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateSourcePreferencePayloadKeySpecifier | (() => undefined | UpdateSourcePreferencePayloadKeySpecifier),
		fields?: UpdateSourcePreferencePayloadFieldPolicy,
	},
	UpdateStatus?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateStatusKeySpecifier | (() => undefined | UpdateStatusKeySpecifier),
		fields?: UpdateStatusFieldPolicy,
	},
	UpdateStatusCategoryType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateStatusCategoryTypeKeySpecifier | (() => undefined | UpdateStatusCategoryTypeKeySpecifier),
		fields?: UpdateStatusCategoryTypeFieldPolicy,
	},
	UpdateStatusType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateStatusTypeKeySpecifier | (() => undefined | UpdateStatusTypeKeySpecifier),
		fields?: UpdateStatusTypeFieldPolicy,
	},
	UpdateStopPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateStopPayloadKeySpecifier | (() => undefined | UpdateStopPayloadKeySpecifier),
		fields?: UpdateStopPayloadFieldPolicy,
	},
	UpdateTrackPayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdateTrackPayloadKeySpecifier | (() => undefined | UpdateTrackPayloadKeySpecifier),
		fields?: UpdateTrackPayloadFieldPolicy,
	},
	UpdaterJobsInfoType?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdaterJobsInfoTypeKeySpecifier | (() => undefined | UpdaterJobsInfoTypeKeySpecifier),
		fields?: UpdaterJobsInfoTypeFieldPolicy,
	},
	UpdaterUpdates?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | UpdaterUpdatesKeySpecifier | (() => undefined | UpdaterUpdatesKeySpecifier),
		fields?: UpdaterUpdatesFieldPolicy,
	},
	ValidateBackupResult?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ValidateBackupResultKeySpecifier | (() => undefined | ValidateBackupResultKeySpecifier),
		fields?: ValidateBackupResultFieldPolicy,
	},
	ValidateBackupSource?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ValidateBackupSourceKeySpecifier | (() => undefined | ValidateBackupSourceKeySpecifier),
		fields?: ValidateBackupSourceFieldPolicy,
	},
	ValidateBackupTracker?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | ValidateBackupTrackerKeySpecifier | (() => undefined | ValidateBackupTrackerKeySpecifier),
		fields?: ValidateBackupTrackerFieldPolicy,
	},
	WebUIUpdateCheck?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | WebUIUpdateCheckKeySpecifier | (() => undefined | WebUIUpdateCheckKeySpecifier),
		fields?: WebUIUpdateCheckFieldPolicy,
	},
	WebUIUpdateInfo?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | WebUIUpdateInfoKeySpecifier | (() => undefined | WebUIUpdateInfoKeySpecifier),
		fields?: WebUIUpdateInfoFieldPolicy,
	},
	WebUIUpdatePayload?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | WebUIUpdatePayloadKeySpecifier | (() => undefined | WebUIUpdatePayloadKeySpecifier),
		fields?: WebUIUpdatePayloadFieldPolicy,
	},
	WebUIUpdateStatus?: Omit<TypePolicy, "fields" | "keyFields"> & {
		keyFields?: false | WebUIUpdateStatusKeySpecifier | (() => undefined | WebUIUpdateStatusKeySpecifier),
		fields?: WebUIUpdateStatusFieldPolicy,
	}
};
export type TypedTypePolicies = StrictTypedTypePolicies & TypePolicies;