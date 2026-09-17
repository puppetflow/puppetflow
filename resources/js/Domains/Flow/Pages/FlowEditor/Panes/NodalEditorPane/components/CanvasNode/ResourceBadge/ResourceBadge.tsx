import { Icon } from '@/Shared/UI/Icon/Icon';
import type { ReferenceDisplay } from '@/Domains/Flow/Pages/FlowEditor/Panes/NodalEditorPane/DataInspector/referenceDisplays';
import * as S from './styled';

interface ResourceBadgeProps {
    resource: ReferenceDisplay;
    onClick: () => void;
}

export default function ResourceBadge({ resource, onClick }: ResourceBadgeProps) {
    return (
        <S.Button
            type="button"
            $color={resource.iconColor}
            title={`Edit ${resource.label}`}
            aria-label={`Edit ${resource.label}`}
            onPointerDown={event => event.stopPropagation()}
            onClick={event => {
                event.stopPropagation();
                onClick();
            }}
            onDoubleClick={event => event.stopPropagation()}
        >
            <Icon
                icon={resource.icon}
                width={16}
                height={16}
            />
        </S.Button>
    );
}
