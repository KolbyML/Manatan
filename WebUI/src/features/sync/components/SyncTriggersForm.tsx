
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import { useSync } from '../services/SyncContext';
import { SyncConfig } from '../Sync.types';

interface TriggerOption {
    key: keyof Pick<SyncConfig, 'syncOnAppStart' | 'syncOnAppResume' | 'syncOnChapterRead' | 'syncOnChapterOpen'>;
    label: string;
}

const TRIGGER_OPTIONS: TriggerOption[] = [
    { key: 'syncOnAppStart', label: 'Sync when app starts' },
    { key: 'syncOnAppResume', label: 'Sync when app resumes' },
    { key: 'syncOnChapterRead', label: 'Sync after reading a chapter' },
    { key: 'syncOnChapterOpen', label: 'Sync when opening a chapter' },
];

export function SyncTriggersForm() {
    const { config, updateConfig, isSyncing, status } = useSync();

    if (!status?.connected) {
        return null;
    }

    return (
        <Card>
            <CardHeader 
                title="Auto Sync" 
                subheader="Automatically sync in the background" 
            />
            <CardContent>
                <List disablePadding>
                    {TRIGGER_OPTIONS.map((option) => (
                        <ListItem
                            key={option.key}
                            secondaryAction={
                                <Switch
                                    checked={config[option.key]}
                                    onChange={(e) => updateConfig({ [option.key]: e.target.checked })}
                                    disabled={isSyncing}
                                />
                            }
                        >
                            <ListItemText primary={option.label} />
                        </ListItem>
                    ))}
                </List>
            </CardContent>
        </Card>
    );
}