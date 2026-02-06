
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import SyncIcon from '@mui/icons-material/Sync';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useSync } from '../services/SyncContext';

export function SyncActionsCard() {
    const { status, isSyncing, progress, sync, pullOnly, pushOnly } = useSync();

    if (!status?.connected) {
        return null;
    }

    return (
        <Card>
            <CardHeader title="Sync Actions" />
            <CardContent>
                <Stack spacing={2}>
                    {isSyncing && progress && (
                        <Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                {progress.message}
                            </Typography>
                            <LinearProgress
                                variant={progress.percent !== undefined ? 'determinate' : 'indeterminate'}
                                value={progress.percent}
                            />
                        </Box>
                    )}

                    <Stack direction="row" spacing={2} flexWrap="wrap">
                        <Button
                            variant="contained"
                            onClick={sync}
                            disabled={isSyncing}
                            startIcon={<SyncIcon />}
                        >
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={pullOnly}
                            disabled={isSyncing}
                            startIcon={<CloudDownloadIcon />}
                        >
                            Pull Only
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={pushOnly}
                            disabled={isSyncing}
                            startIcon={<CloudUploadIcon />}
                        >
                            Push Only
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}