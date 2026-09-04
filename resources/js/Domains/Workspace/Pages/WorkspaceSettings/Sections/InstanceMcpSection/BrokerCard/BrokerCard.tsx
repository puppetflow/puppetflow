import { useToast } from '@/App/Hooks/useToast';
import * as SharedS from '@/Domains/Workspace/Pages/WorkspaceSettings/shared.styled';
import { usePersistedAccordion } from '@/Domains/Workspace/Pages/WorkspaceSettings/Sections/InstanceMcpSection/usePersistedAccordion';
import Button from '@/Shared/UI/Button/Button';
import { Icon } from '@/Shared/UI/Icon/Icon';
import Input from '@/Shared/UI/Input/Input';
import * as S from './styled';

interface Props {
    endpoint: string;
}

export default function BrokerCard({ endpoint }: Props) {
    const { toast } = useToast();
    const [expanded, setExpanded] = usePersistedAccordion('universal');

    const copyEndpoint = async () => {
        try {
            await navigator.clipboard.writeText(endpoint);
            toast('Universal MCP endpoint copied');
        } catch {
            toast('Unable to copy endpoint', 'error');
        }
    };

    return (
        <SharedS.AccordionCard open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
            <SharedS.AccordionSummary>
                <SharedS.AccordionSummaryContent>
                    <S.ModeLabel>Recommended for Claude and ChatGPT</S.ModeLabel>
                    <SharedS.CardTitle>
                        <Icon icon="lucide:radio-tower" width={15} height={15} />
                        Universal MCP Connection
                    </SharedS.CardTitle>
                    <S.SectionHint>
                        Use this single public address when connecting from the Puppetflow catalog listing.
                        The sign-in flow asks for your Puppetflow instance, then lets you choose an MCP-enabled workspace.
                        No workspace URL or access token needs to be copied.
                    </S.SectionHint>
                </SharedS.AccordionSummaryContent>
                <SharedS.AccordionToggle data-accordion-toggle>
                    {expanded ? 'Close' : 'Open'}
                    <Icon data-accordion-chevron icon="lucide:chevron-down" width={15} height={15} />
                </SharedS.AccordionToggle>
            </SharedS.AccordionSummary>
            <SharedS.AccordionBody>
                <S.EndpointRow>
                    <Input label="Universal MCP endpoint" value={endpoint} readOnly />
                    <Button type="button" variant="secondary" size="md" onClick={() => void copyEndpoint()}>
                        <Icon icon="lucide:copy" width={14} height={14} />
                        Copy
                    </Button>
                </S.EndpointRow>
                <S.Flow>
                    <S.Step>
                        <S.StepNumber>1</S.StepNumber>
                        <Icon icon="lucide:monitor" width={14} height={14} />
                        <span>Choose your instance</span>
                    </S.Step>
                    <S.Separator aria-hidden="true">→</S.Separator>
                    <S.Step>
                        <S.StepNumber>2</S.StepNumber>
                        <Icon icon="lucide:key-round" width={14} height={14} />
                        <span>Sign in to Puppetflow</span>
                    </S.Step>
                    <S.Separator aria-hidden="true">→</S.Separator>
                    <S.Step>
                        <S.StepNumber>3</S.StepNumber>
                        <Icon icon="lucide:layers" width={14} height={14} />
                        <span>Select a workspace</span>
                    </S.Step>
                </S.Flow>
            </SharedS.AccordionBody>
        </SharedS.AccordionCard>
    );
}
