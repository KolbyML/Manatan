
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import { useSync } from '../services/SyncContext';
import { SyncService } from '../services/SyncService';

export function SyncAdvancedOptions() {
    const { status } = useSync();

    return (
        <Card>
            <CardHeader title="Advanced" />
            <CardContent>
                <Stack spacing={2}>
                    <div>
                        <Typography variant="subtitle2" color="text.secondary">
                            Device ID
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {SyncService.getDeviceId()}
                        </Typography>
                    </div>

                    <Divider />

                    {status?.connected && (
                        <div>
                            <Typography variant="subtitle2" color="text.secondary">
                                Backend
                            </Typography>
                            <Typography variant="body2">
                                {status.backend === 'googledrive' ? 'Google Drive' : status.backend}
                            </Typography>
                        </div>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}