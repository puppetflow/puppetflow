import { Icon } from '@/Shared/UI/Icon/Icon';
import type { ExplorerConfig } from '@/Shared/Explorer/types';
import MediaItemCard from '@/Domains/Media/Components/MediaItemCard/MediaItemCard';
import type { MediaAsset } from '@/Domains/Media/types';
import { mediaIcon, mediaIconColor } from '@/Domains/Media/types';
import MediaRow from './MediaRow/MediaRow';
import { Thumbnail } from './MediaRow/styled';
import MediaUploadAction from './MediaUploadAction';

// Media specific adapter for the shared explorer kit.
export const mediaExplorerConfig: ExplorerConfig<MediaAsset> = {
    key: 'media',
    basePath: '/media-library',
    title: 'Media Library',
    documentationPath: '/guide/media',
    documentationLabel: 'Open media documentation',
    dragType: 'media',
    labels: {
        item: 'media file',
        items: 'media files',
        searchPlaceholder: 'Search media...',
        emptyTitle: 'No media yet',
        emptyDescription: 'Upload files or drag them anywhere into this area',
        sharedEmptyDescription: 'Media shared with the workspace will appear here',
        deleteFolderWarning: 'All media files in this folder will be permanently deleted. This action cannot be undone.',
    },
    endpoints: {
        folders: '/media-library/folders',
        folderScopeMoves: true,
        moveItem: id => `/media-library/media/${id}/move`,
        batchDelete: '/media-library/batch-delete',
    },
    gridColumns: 5,
    canManageItem: item => item.can_manage,
    renderItemCard: props => <MediaItemCard {...props} />,
    renderItemIcon: item => (
        item.thumbnail_url
            ? <Thumbnail src={item.thumbnail_url} alt="" loading="lazy" />
            : <Icon icon={mediaIcon(item.mime_type)} width={16} style={{ color: mediaIconColor(item.mime_type) }} />
    ),
    renderTreeItem: ({ item, depth }) => <MediaRow item={item} depth={depth} />,
    renderEmptyAction: () => <MediaUploadAction />,
};
