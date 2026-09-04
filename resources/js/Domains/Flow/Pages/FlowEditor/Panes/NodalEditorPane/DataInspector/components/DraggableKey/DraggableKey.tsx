import * as S from './styled';

interface DraggableKeyProps {
    label: string;
    path: string;
    draggable?: boolean;
}

export default function DraggableKey({ label, path, draggable = true }: DraggableKeyProps) {
    return (
        <S.JsonKey
            data-inspector-key
            draggable={draggable}
            $draggable={draggable}
            onDragStart={draggable ? event => {
                event.dataTransfer.setData('text/plain', path);
                event.dataTransfer.effectAllowed = 'copy';
            } : undefined}
        >
            {label}
        </S.JsonKey>
    );
}
