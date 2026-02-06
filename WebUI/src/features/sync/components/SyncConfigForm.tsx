
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import WarningIcon from '@mui/icons-material/Warning';
import { useSync } from '../services/SyncContext';
import { SyncConfig } from '../Sync.types';

interface DataOption {
    key: keyof Pick<SyncConfig, 'lnProgress' | 'lnMetadata' | 'lnContent' | 'lnFiles'>;
    label: string;
    description: string;
    warning?: boolean;
}

const DATA_OPTIONS: DataOption[] = [
    {
        key: 'lnProgress',
        label: 'Reading Progress',
        description: 'Current chapter, page position, and reading history',
    },
    {
        key: 'lnMetadata',
        label: 'Book Metadata',
        description: 'Title, author, cover, and table of contents',
    },
    {
        key: 'lnContent',
        label: 'Parsed Content',
        description: 'Processed chapters and extracted images',
    },
    {
        key: 'lnFiles',
        label: 'EPUB Files',
        description: 'Original EPUB files (can be very large!)',
        warning: true,
    },
];

export function SyncConfigForm() {
    const { config, updateConfig, isSyncing } = useSync();

    return (
        <Card>
            <CardHeader 
                title="What to Sync" 
                subheader="Choose which data to sync across devices" 
            />
            <CardContent>
                <List disablePadding>
                    {DATA_OPTIONS.map((option) => (
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
                            <ListItemText
                                primary={
                                    <>
                                        {option.label}
                                        {option.warning && (
                                            <Chip
                                                icon={<WarningIcon />}
                                                label="Large"
                                                size="small"
                                                color="warning"
                                                sx={{ ml: 1 }}
                                            />
                                        )}
                                    </>
                                }
                                secondary={option.description}
                            />
                        </ListItem>
                    ))}
                </List>
            </CardContent>
        </Card>
    );
}