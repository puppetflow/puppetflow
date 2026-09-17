import { Icon } from '@/Shared/UI/Icon/Icon';
import type { ExplorerItemCardProps } from '@/Shared/Explorer/types';
import type { MediaAsset } from '@/Domains/Media/types';
import { formatMediaSize, mediaIcon, mediaIconColor } from '@/Domains/Media/types';
import { useMediaInspector } from '@/Domains/Media/Pages/MediaLibrary/mediaInspectorContext';
import * as S from './styled';

// Media card for the shared explorer: a click opens the metadata modal,
// the checkbox drives bulk selection and the card is draggable into folders.
export default function MediaItemCard({
    item,
    variant,
    selectionActive,
    selected,
    onToggleSelect,
}: ExplorerItemCardProps<MediaAsset>) {
    const { inspect } = useMediaInspector();
    const selectable = item.can_manage;
    const visibleTagCount = variant === 'grid' ? 3 : 2;
    const thumbnailUrl = item.thumbnail_url
        ?? (item.mime_type.startsWith('image/') ? item.url : null);

    const handleDragStart = (event: React.DragEvent) => {
        if (!item.can_manage) {
            event.preventDefault();
            return;
        }
        event.dataTransfer.setData('application/x-drag-type', 'media');
        event.dataTransfer.setData('application/x-drag-id', String(item.id));
        event.dataTransfer.setData('application/x-drag-visibility', item.visibility);
        event.dataTransfer.setData('application/x-drag-team-id', item.team_id === null ? '' : String(item.team_id));
        event.dataTransfer.setData('application/x-drag-owner-id', item.owner_id === null ? '' : String(item.owner_id));
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <S.Card
            $view={variant}
            $selected={selected}
            $selectionActive={selectionActive}
            role="button"
            tabIndex={0}
            draggable={item.can_manage}
            onDragStart={handleDragStart}
            onClick={() => inspect(item)}
            onKeyDown={event => {
                if (
                    event.target === event.currentTarget
                    && (event.key === 'Enter' || event.key === ' ')
                ) {
                    event.preventDefault();
                    inspect(item);
                }
            }}
        >
            {selectable && (
                <S.Selection
                    type="checkbox"
                    checked={selected}
                    $view={variant}
                    $selected={selected}
                    $selectionActive={selectionActive}
                    onClick={event => event.stopPropagation()}
                    onChange={() => onToggleSelect(item)}
                    aria-label={`${selected ? 'Deselect' : 'Select'} ${item.name}`}
                />
            )}
            <S.Preview $view={variant}>
                <S.PreviewContent
                    $view={variant}
                    $showCheckbox={selected || selectionActive}
                >
                    {thumbnailUrl ? (
                        <S.Thumbnail
                            src={thumbnailUrl}
                            alt={item.alt_text || (item.mime_type.startsWith('video/') ? `${item.name} thumbnail` : '')}
                            loading="lazy"
                            draggable={false}
                        />
                    ) : (
                        <S.FileIcon $color={mediaIconColor(item.mime_type)}>
                            <Icon icon={mediaIcon(item.mime_type)} width={variant === 'grid' ? 34 : 22} />
                        </S.FileIcon>
                    )}
                </S.PreviewContent>
            </S.Preview>
            <S.Details $view={variant}>
                <S.Name title={item.name}>{item.name}</S.Name>
                <S.Meta>
                    <S.Type>{item.extension?.toUpperCase() || item.mime_type.split('/')[1]?.toUpperCase()}</S.Type>
                    <S.Separator aria-hidden />
                    {formatMediaSize(item.size_bytes)}
                    {variant === 'list' && item.owner && (
                        <>
                            <S.Separator aria-hidden />
                            <S.Type>{item.owner.name}</S.Type>
                        </>
                    )}
                    {(item.tags?.length ?? 0) > 0 && (
                        <S.Tags $view={variant}>
                            {item.tags?.slice(0, visibleTagCount).map(tag => (
                                <S.Tag key={tag} title={tag}>{tag}</S.Tag>
                            ))}
                            {(item.tags?.length ?? 0) > visibleTagCount && (
                                <S.TagCount>
                                    +{(item.tags?.length ?? 0) - visibleTagCount}
                                </S.TagCount>
                            )}
                        </S.Tags>
                    )}
                </S.Meta>
            </S.Details>
        </S.Card>
    );
}
