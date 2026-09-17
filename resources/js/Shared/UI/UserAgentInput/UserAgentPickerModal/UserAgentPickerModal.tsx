import { useEffect, useMemo, useState } from 'react';
import Modal from '@/Shared/UI/Modal/Modal';
import Button from '@/Shared/UI/Button/Button';
import { Icon } from '@/Shared/UI/Icon/Icon';
import {
    BROWSERS,
    PLATFORMS,
    buildUserAgent,
    defaultSelection,
    describeSelection,
    platformsFor,
    randomSelection,
    variantsFor,
    versionsFor,
    type BrowserId,
    type PickerOption,
    type PlatformId,
    type UserAgentSelection,
} from '@/Shared/Utils/userAgents';
import * as S from './styled';

interface UserAgentPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (userAgent: string) => void;
}

interface OptionColumnProps {
    title: string;
    options: PickerOption[];
    activeId: string;
    onPick: (id: string) => void;
    iconFor?: (id: string) => string | undefined;
}

function OptionColumn({ title, options, activeId, onPick, iconFor }: OptionColumnProps) {
    return (
        <S.Column>
            <S.ColumnTitle>{title}</S.ColumnTitle>
            <S.OptionList role="listbox" aria-label={title}>
                {options.map(option => {
                    const icon = iconFor?.(option.id);
                    return (
                        <S.Option
                            key={option.id}
                            type="button"
                            role="option"
                            aria-selected={option.id === activeId}
                            $active={option.id === activeId}
                            onClick={() => onPick(option.id)}
                        >
                            {icon && (
                                <S.OptionIcon>
                                    <Icon icon={icon} width={14} height={14} />
                                </S.OptionIcon>
                            )}
                            <S.OptionText>
                                <S.OptionLabel>{option.label}</S.OptionLabel>
                                {option.hint && <S.OptionHint>{option.hint}</S.OptionHint>}
                            </S.OptionText>
                        </S.Option>
                    );
                })}
            </S.OptionList>
        </S.Column>
    );
}

export default function UserAgentPickerModal({ isOpen, onClose, onSelect }: UserAgentPickerModalProps) {
    const [selection, setSelection] = useState<UserAgentSelection>(() => defaultSelection('chrome', 'windows'));

    useEffect(() => {
        if (isOpen) setSelection(defaultSelection('chrome', 'windows'));
    }, [isOpen]);

    const platforms = useMemo(() => platformsFor(selection.browser), [selection.browser]);
    const versions = useMemo(() => versionsFor(selection.browser, selection.platform), [selection.browser, selection.platform]);
    const variants = useMemo(() => variantsFor(selection.browser, selection.platform), [selection.browser, selection.platform]);
    const userAgent = useMemo(() => buildUserAgent(selection), [selection]);

    const pickBrowser = (browser: BrowserId) => {
        setSelection(current => defaultSelection(browser, current.platform));
    };

    const pickPlatform = (platform: PlatformId) => {
        setSelection(current => defaultSelection(current.browser, platform));
    };

    const pickVersion = (version: string) => {
        setSelection(current => ({ ...current, version }));
    };

    const pickVariant = (variant: string) => {
        setSelection(current => ({ ...current, variant }));
    };

    const handleShuffle = () => {
        setSelection(randomSelection());
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Choose a user agent"
            caption="Pick a browser, a platform and a version to build a plausible user agent string."
            width="820px"
            footer={(
                <>
                    <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={() => onSelect(userAgent)}>
                        <Icon icon="lucide:check" width={13} height={13} />
                        Use this user agent
                    </Button>
                </>
            )}
        >
            <S.Layout>
                <S.Columns>
                    <OptionColumn
                        title="Browser"
                        options={BROWSERS}
                        activeId={selection.browser}
                        onPick={id => pickBrowser(id as BrowserId)}
                        iconFor={id => BROWSERS.find(browser => browser.id === id)?.icon}
                    />
                    <OptionColumn
                        title="Platform"
                        options={platforms}
                        activeId={selection.platform}
                        onPick={id => pickPlatform(id as PlatformId)}
                        iconFor={id => PLATFORMS[id as PlatformId]?.icon}
                    />
                    <OptionColumn
                        title="Version"
                        options={versions}
                        activeId={selection.version}
                        onPick={pickVersion}
                    />
                    <OptionColumn
                        title="Device / OS"
                        options={variants}
                        activeId={selection.variant}
                        onPick={pickVariant}
                    />
                </S.Columns>

                <S.Preview>
                    <S.PreviewHeader>
                        <S.PreviewHeading>
                            <S.PreviewTitle>Preview</S.PreviewTitle>
                            <S.PreviewSummary title={describeSelection(selection)}>{describeSelection(selection)}</S.PreviewSummary>
                        </S.PreviewHeading>
                        <S.ShuffleButton type="button" onClick={handleShuffle} title="Randomize the selection without applying it">
                            <Icon icon="lucide:shuffle" width={12} height={12} />
                            Shuffle
                        </S.ShuffleButton>
                    </S.PreviewHeader>
                    <S.PreviewValue>{userAgent}</S.PreviewValue>
                </S.Preview>
            </S.Layout>
        </Modal>
    );
}
