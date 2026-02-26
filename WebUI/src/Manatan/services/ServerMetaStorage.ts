import { requestManager } from '@/lib/requests/RequestManager.ts';
import { MetaType } from '@/lib/requests/types.ts';

export const MANATAN_SETTINGS_META_KEY = 'manatan_settings_v1';
export const MANATAN_LN_SETTINGS_META_KEY = 'manatan_ln_settings_by_language_v1';
export const MANATAN_SRS_UI_STATE_META_KEY = 'manatan_srs_ui_state_v1';

const toMetaMap = (nodes?: MetaType[]): Record<string, string> => {
    const map: Record<string, string> = {};
    (nodes ?? []).forEach((node) => {
        if (!node?.key) {
            return;
        }
        map[node.key] = node.value ?? '';
    });
    return map;
};

export const getServerMetaMap = async (): Promise<Record<string, string>> => {
    const { data, error } = await requestManager.getGlobalMeta().response;
    if (error) {
        throw error;
    }
    return toMetaMap(data?.metas?.nodes);
};

export const getServerMetaValue = async (key: string): Promise<string | undefined> => {
    const meta = await getServerMetaMap();
    return meta[key];
};

export const setServerMetaValue = async (key: string, value: string): Promise<void> => {
    await requestManager.setGlobalMetadata(key, value).response;
};

export const getServerMetaJson = async <T>(key: string, fallback: T): Promise<T> => {
    const raw = await getServerMetaValue(key);
    if (!raw) {
        return fallback;
    }

    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
};

export const setServerMetaJson = async <T>(key: string, value: T): Promise<void> => {
    await setServerMetaValue(key, JSON.stringify(value));
};
