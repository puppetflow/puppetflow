import Button from '@/Shared/UI/Button/Button';
import { Icon } from '@/Shared/UI/Icon/Icon';
import { useMediaInspector } from './mediaInspectorContext';

// Empty state action: opens the file picker for the current location.
export default function MediaUploadAction() {
    const { openUploadDialog } = useMediaInspector();

    return (
        <Button size="sm" onClick={openUploadDialog}>
            <Icon icon="lucide:upload" width={14} />
            Upload files
        </Button>
    );
}
