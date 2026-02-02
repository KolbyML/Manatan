import { useOCR } from '@/Manatan/context/OCRContext';

const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export const useIsMobile = (): boolean => {
    const isUserAgentMobile = MOBILE_UA_REGEX.test(navigator.userAgent);

    let isSettingMobile = false;
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { settings } = useOCR();
        isSettingMobile = settings?.mobileMode || false;
        } 
    catch (e) { 
        /* ignore */
    }

    return isUserAgentMobile || isSettingMobile;
};