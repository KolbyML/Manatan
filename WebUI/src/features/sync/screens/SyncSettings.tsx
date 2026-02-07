
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import { useAppTitle } from '@/features/navigation-bar/hooks/useAppTitle';
import { useSync } from '../services/SyncContext';
import { SyncStatusCard } from '../components/SyncStatusCard';
import { SyncActionsCard } from '../components/SyncActionsCard';
import { SyncConfigForm } from '../components/SyncConfigForm';
import { SyncTriggersForm } from '../components/SyncTriggersForm';
import { SyncStorageOptions } from '../components/SyncStorageOptions';
import { SyncAdvancedOptions } from '../components/SyncAdvancedOptions';

export function SyncSettings() {
    const { error, lastConflicts, clearError } = useSync();
    useAppTitle('Sync');

    return (
        <Box sx={{ p: 2 }}>
            <Stack spacing={3}>
                {error && (
                    <Alert severity="error" onClose={clearError}>
                        <AlertTitle>Sync Error</AlertTitle>
                        {error}
                    </Alert>
                )}

                {/* Safety check added here */}
                {lastConflicts && lastConflicts.length > 0 && (
                    <Alert severity="info">
                        <AlertTitle>Conflicts Resolved</AlertTitle>
                        {lastConflicts.map((conflict, index) => (
                            <Box key={index} sx={{ fontSize: '0.875rem' }}>
                                • {conflict.bookId}: {conflict.field} - {conflict.resolution}
                            </Box>
                        ))}
                    </Alert>
                )}

                <SyncStatusCard />
                <SyncActionsCard />
                <SyncConfigForm />
                <SyncTriggersForm />
                <SyncStorageOptions />
                <SyncAdvancedOptions />
            </Stack>
        </Box>
    );
}