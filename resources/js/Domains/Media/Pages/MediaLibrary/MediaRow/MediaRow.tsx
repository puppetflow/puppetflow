import { Icon } from '@/Shared/UI/Icon/Icon';
import type { MediaTreeItem } from '@/Domains/Media/types';
import { mediaIcon, mediaIconColor } from '@/Domains/Media/types';
import { TreeChevronSpacer, TreeItemLabel } from '@/Shared/Explorer/TreeSidebar/components/shared.styled';
import { useMediaInspector } from '../mediaInspectorContext';
import * as S from './styled';

interface Props {
    item: MediaTreeItem;
    depth: number;
}

// Sidebar row for a media asset. A click opens the metadata modal.
export default function MediaRow({ item, depth }: Props) {
    const { inspect } = useMediaInspector();

    return (
        <S.Row
            as="button"
            type="button"
            $depth={depth}
            onClick={() => inspect(item)}
        >
            <TreeChevronSpacer />
            <S.IconSlot>
                {item.thumbnail_url
                    ? <S.Thumbnail src={item.thumbnail_url} alt="" loading="lazy" />
                    : (
                        <Icon
                            icon={mediaIcon(item.mime_type)}
                            width={14}
                            style={{ color: mediaIconColor(item.mime_type) }}
                        />
                    )}
            </S.IconSlot>
            <TreeItemLabel>{item.name}</TreeItemLabel>
        </S.Row>
    );
}
