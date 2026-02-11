
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import CloudIcon from '@mui/icons-material/Cloud';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { useSync } from '../services/SyncContext';

export function SyncStatusCard() {
    const { status, lastSyncTime, connect, disconnect, isSyncing } = useSync();

    const formatLastSync = (date: Date | null): string => {
        if (!date) return 'Never synced';

        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        return `${days} day${days > 1 ? 's' : ''} ago`;
    };

    return (
        <Card>
            <CardHeader
                avatar={status?.connected ? <CloudIcon color="success" /> : <CloudOffIcon color="disabled" />}
                title="Connection Status"
                action={
                    <Chip
                        label={status?.connected ? 'Connected' : 'Disconnected'}
                        color={status?.connected ? 'success' : 'default'}
                        size="small"
                    />
                }
            />
            <CardContent>
                <Stack spacing={2}>
                    {status?.connected ? (
                        <>
                            <Typography variant="body2" color="text.secondary">
                                Email: {status.email || 'Unknown'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Last sync: {formatLastSync(lastSyncTime)}
                            </Typography>
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={disconnect}
                            >
                                Disconnect
                            </Button>
                        </>
                    ) : (
                        <>
                            <Typography variant="body2" color="text.secondary">
                                Connect to Google Drive to sync your reading progress across devices.
                            </Typography>
                            <Button
                                variant="contained"
                                onClick={connect}
                                disabled={isSyncing}
                                startIcon={<CloudIcon />}
                            >
                                Connect Google Drive
                            </Button>
                        </>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}
