
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSync } from '../services/SyncContext';
import { GoogleDriveFolderType, DeletionBehavior } from '../Sync.types';

export function SyncStorageOptions() {
    const { config, updateConfig, isSyncing, status } = useSync();

    if (!status?.connected) {
        return null;
    }

    return (
        <Card>
            <CardHeader title="Storage Options" />
            <CardContent>
                <Stack spacing={3}>
                    {/* Folder Type */}
                    <FormControl component="fieldset">
                        <Typography variant="subtitle2" gutterBottom>
                            Storage Location
                        </Typography>
                        <RadioGroup
                            value={config.googleDriveFolderType}
                            onChange={(e) =>
                                updateConfig({ googleDriveFolderType: e.target.value as GoogleDriveFolderType })
                            }
                        >
                            <FormControlLabel
                                value="public"
                                control={<Radio disabled={isSyncing} />}
                                label={
                                    <Stack>
                                        <Typography variant="body1">Public Folder</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Visible in your Google Drive, easy to backup manually
                                        </Typography>
                                    </Stack>
                                }
                            />
                            <FormControlLabel
                                value="appData"
                                control={<Radio disabled={isSyncing} />}
                                label={
                                    <Stack>
                                        <Typography variant="body1">App Data Folder</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Hidden folder, only accessible by this app
                                        </Typography>
                                    </Stack>
                                }
                            />
                        </RadioGroup>
                    </FormControl>

                    {/* Folder Name (only for public) */}
                    {config.googleDriveFolderType === 'public' && (
                        <TextField
                            label="Folder Name"
                            value={config.googleDriveFolder}
                            onChange={(e) => updateConfig({ googleDriveFolder: e.target.value })}
                            disabled={isSyncing}
                            size="small"
                            helperText="Name of the folder in Google Drive"
                        />
                    )}

                    {/* Deletion Behavior */}
                    <FormControl component="fieldset">
                        <Typography variant="subtitle2" gutterBottom>
                            When Deleting Books
                        </Typography>
                        <RadioGroup
                            value={config.deletionBehavior}
                            onChange={(e) =>
                                updateConfig({ deletionBehavior: e.target.value as DeletionBehavior })
                            }
                        >
                            <FormControlLabel
                                value="keepEverywhere"
                                control={<Radio disabled={isSyncing} />}
                                label="Keep in cloud (delete locally only)"
                            />
                            <FormControlLabel
                                value="deleteEverywhere"
                                control={<Radio disabled={isSyncing} />}
                                label="Delete everywhere (all devices)"
                            />
                            <FormControlLabel
                                value="askEachTime"
                                control={<Radio disabled={isSyncing} />}
                                label="Ask each time"
                            />
                        </RadioGroup>
                    </FormControl>
                </Stack>
            </CardContent>
        </Card>
    );
}