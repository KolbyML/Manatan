
import { SelectSettingValue, SelectSettingValueDisplayInfo } from '@/base/components/settings/SelectSetting.tsx';
import { TranslationKey } from '@/base/Base.types.ts';
import {
    SyncBackendType,
    GoogleDriveFolderType,
    DeletionBehavior,
    SyncConfig,
} from './Sync.types.ts';

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
    ln_progress: true,
    ln_metadata: true,
    ln_content: true,
    ln_files: false,
    syncOnChapterRead: false,
    syncOnChapterOpen: false,
    syncOnAppStart: false,
    syncOnAppResume: false,
    backend: 'none',
    google_drive_folder: 'Manatan',
    google_drive_folder_type: 'public',
    deletion_behavior: 'keepEverywhere',
};

// Backend type options
const SYNC_BACKEND_TYPES: SyncBackendType[] = ['none', 'googledrive', 'webdav', 'syncyomi'];
const SYNC_BACKEND_TYPE_TO_TRANSLATION: Record<SyncBackendType, SelectSettingValueDisplayInfo> = {
    none: {
        text: 'sync.backend.option.none.label',
        description: 'sync.backend.option.none.description',
    },
    googledrive: {
        text: 'sync.backend.option.googledrive.label',
        description: 'sync.backend.option.googledrive.description',
    },
    webdav: {
        text: 'sync.backend.option.webdav.label',
        description: 'sync.backend.option.webdav.description',
    },
    syncyomi: {
        text: 'sync.backend.option.syncyomi.label',
        description: 'sync.backend.option.syncyomi.description',
    },
};
export const SYNC_BACKEND_SELECT_VALUES: SelectSettingValue<SyncBackendType>[] = SYNC_BACKEND_TYPES.map((type) => [
    type,
    SYNC_BACKEND_TYPE_TO_TRANSLATION[type],
]);

// Google Drive folder type options
const GOOGLE_DRIVE_FOLDER_TYPES: GoogleDriveFolderType[] = ['public', 'appData'];
const GOOGLE_DRIVE_FOLDER_TYPE_TO_TRANSLATION: Record<GoogleDriveFolderType, SelectSettingValueDisplayInfo> = {
    public: {
        text: 'sync.googledrive.folder_type.option.public.label',
        description: 'sync.googledrive.folder_type.option.public.description',
    },
    appData: {
        text: 'sync.googledrive.folder_type.option.appdata.label',
        description: 'sync.googledrive.folder_type.option.appdata.description',
    },
};
export const GOOGLE_DRIVE_FOLDER_TYPE_SELECT_VALUES: SelectSettingValue<GoogleDriveFolderType>[] =
    GOOGLE_DRIVE_FOLDER_TYPES.map((type) => [type, GOOGLE_DRIVE_FOLDER_TYPE_TO_TRANSLATION[type]]);

// Deletion behavior options
const DELETION_BEHAVIORS: DeletionBehavior[] = ['keepEverywhere', 'deleteEverywhere', 'askEachTime'];
const DELETION_BEHAVIOR_TO_TRANSLATION: Record<DeletionBehavior, SelectSettingValueDisplayInfo> = {
    keepEverywhere: {
        text: 'sync.deletion.option.keep.label',
        description: 'sync.deletion.option.keep.description',
    },
    deleteEverywhere: {
        text: 'sync.deletion.option.delete.label',
        description: 'sync.deletion.option.delete.description',
    },
    askEachTime: {
        text: 'sync.deletion.option.ask.label',
        description: 'sync.deletion.option.ask.description',
    },
};
export const DELETION_BEHAVIOR_SELECT_VALUES: SelectSettingValue<DeletionBehavior>[] = DELETION_BEHAVIORS.map(
    (behavior) => [behavior, DELETION_BEHAVIOR_TO_TRANSLATION[behavior]],
);

// What to sync options
export const SYNC_DATA_OPTIONS: { key: keyof Pick<SyncConfig, 'ln_progress' | 'ln_metadata' | 'ln_content' | 'ln_files'>; labelKey: TranslationKey; descriptionKey?: TranslationKey; warning?: boolean }[] = [
    {
        key: 'ln_progress',
        labelKey: 'sync.data.option.progress.label',
        descriptionKey: 'sync.data.option.progress.description',
    },
    {
        key: 'ln_metadata',
        labelKey: 'sync.data.option.metadata.label',
        descriptionKey: 'sync.data.option.metadata.description',
    },
    {
        key: 'ln_content',
        labelKey: 'sync.data.option.content.label',
        descriptionKey: 'sync.data.option.content.description',
    },
    {
        key: 'ln_files',
        labelKey: 'sync.data.option.files.label',
        descriptionKey: 'sync.data.option.files.description',
        warning: true,
    },
];

// Sync trigger options
export const SYNC_TRIGGER_OPTIONS: { key: keyof Pick<SyncConfig, 'syncOnAppStart' | 'syncOnAppResume' | 'syncOnChapterRead' | 'syncOnChapterOpen'>; labelKey: TranslationKey }[] = [
    {
        key: 'syncOnAppStart',
        labelKey: 'sync.trigger.option.app_start.label',
    },
    {
        key: 'syncOnAppResume',
        labelKey: 'sync.trigger.option.app_resume.label',
    },
    {
        key: 'syncOnChapterRead',
        labelKey: 'sync.trigger.option.chapter_read.label',
    },
    {
        key: 'syncOnChapterOpen',
        labelKey: 'sync.trigger.option.chapter_open.label',
    },
];