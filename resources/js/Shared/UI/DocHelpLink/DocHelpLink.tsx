import type { AnchorHTMLAttributes } from 'react';
import { usePageProps } from '@/App/Hooks/usePageProps';
import { Icon } from '@/Shared/UI/Icon/Icon';
import * as S from './styled';

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> {
    path?: string;
    label?: string;
}

export function DocHelpLink({
    path = '',
    label = 'Open documentation',
    title = label,
    ...props
}: Props) {
    const { settings } = usePageProps();
    const baseUrl = settings.documentation_url.replace(/\/+$/, '');
    const normalizedPath = path === '' ? '' : `/${path.replace(/^\/+/, '')}`;

    return (
        <S.Link
            {...props}
            href={`${baseUrl}${normalizedPath}`}
            target="_blank"
            rel="noopener noreferrer"
            title={title}
            aria-label={label}
        >
            <Icon icon="lucide:circle-help" width={15} height={15} />
        </S.Link>
    );
}

