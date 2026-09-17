import type { ReactNode } from 'react';
import { Icon } from '@/Shared/UI/Icon/Icon';
import * as S from './styled';

interface OptionalDetailsProps {
    title: string;
    children: ReactNode;
}

export default function OptionalDetails({ title, children }: OptionalDetailsProps) {
    return (
        <S.Details>
            <S.Summary>
                {title}
                <Icon icon="lucide:chevron-down" width={14} height={14} />
            </S.Summary>
            <S.Content>{children}</S.Content>
        </S.Details>
    );
}
