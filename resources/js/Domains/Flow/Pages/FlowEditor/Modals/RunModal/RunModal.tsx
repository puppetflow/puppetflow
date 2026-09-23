import Modal from '@/Shared/UI/Modal/Modal';
import RerunInputEditor from './components/RerunInputEditor/RerunInputEditor';
import RunInputEditor from './components/RunInputEditor/RunInputEditor';
import RunModalActions from './components/RunModalActions/RunModalActions';
import RunProxyOverride from './components/RunProxyOverride/RunProxyOverride';
import { useRunSubmission } from './hooks/useRunSubmission';
import type { RunProxyContext, RunSubmitHandler } from './types';

interface RunModalProps {
    flowId: Id;
    isNodalFlow: boolean;
    isOpen: boolean;
    onClose: () => void;
    initialInput: string;
    codeSnapshot: string | null;
    rerunData?: string | null;
    /** When provided, the modal offers a per-run proxy override. */
    proxyContext?: RunProxyContext | null;
    onRun: RunSubmitHandler;
    onSaveInput: (parsedInput: Record<string, unknown>) => void;
}

export default function RunModal({
    flowId,
    isNodalFlow,
    isOpen,
    onClose,
    initialInput,
    codeSnapshot,
    rerunData,
    proxyContext,
    onRun,
    onSaveInput,
}: RunModalProps) {
    const isRerun = !!rerunData;
    const submission = useRunSubmission({
        isOpen,
        initialInput,
        rerunData,
        onRun,
        onSaveInput,
    });

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isRerun ? 'Run Again' : 'Run Flow'}
            width="480px"
            footer={<RunModalActions hasCodeSnapshot={!!codeSnapshot} onRun={submission.handleRun} />}
        >
            {isRerun ? (
                <RerunInputEditor
                    flowId={flowId}
                    value={submission.rerunInput}
                    error={submission.inputError}
                    onChange={submission.setRerunInput}
                />
            ) : (
                <RunInputEditor
                    flowId={flowId}
                    isNodalFlow={isNodalFlow}
                    value={submission.input}
                    error={submission.inputError}
                    visible={submission.showEditor}
                    onChange={submission.handleInputChange}
                    onVisibleChange={submission.handleShowEditorChange}
                />
            )}

            {proxyContext && (
                <RunProxyOverride
                    context={proxyContext}
                    value={submission.proxyChoice}
                    onChange={submission.setProxyChoice}
                />
            )}
        </Modal>
    );
}
