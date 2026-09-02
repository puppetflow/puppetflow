<?php

namespace App\Http\Requests\Flow;

use App\Enums\Authorization\Ability;
use App\Enums\Mailbox\MailboxWatcherRuleField;
use App\Enums\Mailbox\MailboxWatcherRuleOperator;
use App\Http\Requests\Flow\Concerns\PreservesDefaultInputsEmptyStrings;
use App\Models\Flow;
use App\Rules\ValidNodalGraph;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class StoreFlowRequest extends FormRequest
{
    use PreservesDefaultInputsEmptyStrings;

    public function authorize(): bool
    {
        return Gate::forUser($this->user())->allows(Ability::CREATE->value, Flow::class);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        /** @var string|null $workspaceId */
        $workspaceId = session('current_workspace_id');

        return [
            'name' => ['required', 'string', 'max:128'],
            'description' => ['nullable', 'string'],
            'visibility' => ['sometimes', 'in:'.implode(',', app(\App\Services\FeatureFlags\FeatureFlagService::class)->allowedScopes())],
            'team_id' => ['nullable', 'string'],
            'owner_id' => ['nullable', 'string', 'exists:users,id'],
            'folder_id' => ['nullable', 'string'],
            'workspace_folder_id' => ['nullable', 'string'],
            'code' => ['nullable', 'string'],
            'source_type' => ['sometimes', 'in:code,repository,library'],
            'flow_type' => ['sometimes', 'in:code,nodal'],
            'nodal_graph' => ['sometimes', 'nullable', 'array', new ValidNodalGraph],
            'default_inputs' => ['sometimes', 'nullable', 'array'],
            'create_data_tables' => ['sometimes', 'boolean'],
            'data_table_schemas' => ['required_if:create_data_tables,true', 'array', 'max:50'],
            'data_table_schemas.*' => ['array:source_id,name,description,group,columns'],
            'data_table_schemas.*.source_id' => ['required', 'string', 'max:64', 'distinct'],
            'data_table_schemas.*.name' => ['required', 'string', 'max:128'],
            'data_table_schemas.*.description' => ['nullable', 'string'],
            'data_table_schemas.*.group' => ['nullable', 'string', 'max:100'],
            'data_table_schemas.*.columns' => ['required', 'array', 'max:100'],
            'data_table_schemas.*.columns.*' => ['array:name,type'],
            'data_table_schemas.*.columns.*.name' => [
                'required',
                'string',
                'max:63',
                'regex:/^[A-Za-z][A-Za-z0-9_]*$/',
            ],
            'data_table_schemas.*.columns.*.type' => [
                'required',
                Rule::in(['string', 'number', 'boolean', 'datetime']),
            ],
            'create_mailbox_watchers' => ['sometimes', 'boolean'],
            'mailbox_watcher_schemas' => ['required_if:create_mailbox_watchers,true', 'array', 'max:50'],
            'mailbox_watcher_schemas.*' => [
                'array:source_id,name,group,mailbox,extract_enabled,extract_mode,extract_expression,is_active,timeout,rules',
            ],
            'mailbox_watcher_schemas.*.source_id' => ['required', 'string', 'max:64', 'distinct'],
            'mailbox_watcher_schemas.*.name' => ['required', 'string', 'max:100'],
            'mailbox_watcher_schemas.*.group' => ['nullable', 'string', 'max:100'],
            'mailbox_watcher_schemas.*.mailbox' => ['required', 'array:source_id,address'],
            'mailbox_watcher_schemas.*.mailbox.source_id' => ['required', 'string', 'max:64'],
            'mailbox_watcher_schemas.*.mailbox.address' => ['required', 'string', 'max:320'],
            'mailbox_watcher_schemas.*.extract_enabled' => ['required', 'boolean'],
            'mailbox_watcher_schemas.*.extract_mode' => ['required', Rule::in(['regex', 'selector'])],
            'mailbox_watcher_schemas.*.extract_expression' => ['nullable', 'string', 'max:500'],
            'mailbox_watcher_schemas.*.is_active' => ['required', 'boolean'],
            'mailbox_watcher_schemas.*.timeout' => ['nullable', 'integer', 'min:1000', 'max:86400000'],
            'mailbox_watcher_schemas.*.rules' => ['required', 'array', 'max:100'],
            'mailbox_watcher_schemas.*.rules.*' => ['array:rule_group,field,operator,value'],
            'mailbox_watcher_schemas.*.rules.*.rule_group' => ['required', 'integer', 'min:0', 'max:99'],
            'mailbox_watcher_schemas.*.rules.*.field' => ['required', Rule::enum(MailboxWatcherRuleField::class)],
            'mailbox_watcher_schemas.*.rules.*.operator' => ['required', Rule::enum(MailboxWatcherRuleOperator::class)],
            'mailbox_watcher_schemas.*.rules.*.value' => ['required', 'string', 'max:2000'],
            'mailbox_mappings' => ['required_if:create_mailbox_watchers,true', 'array', 'max:50'],
            'mailbox_mappings.*' => ['required', 'string', 'max:64'],
            'queue_index' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:'.config()->integer('puppetflow.queues_counter', 1)],
            'proxy_mode' => ['sometimes', Rule::in(['none', 'auto', 'specific'])],
            'workspace_proxy_id' => [
                'nullable',
                'integer',
                'required_if:proxy_mode,specific',
                Rule::exists('workspace_proxies', 'id')->where('workspace_id', $workspaceId),
            ],
            'proxy_filter_rules' => ['nullable', 'array', 'max:50'],
            'proxy_filter_rules.*' => ['array:rule_group,field,operator,value'],
            'proxy_filter_rules.*.rule_group' => ['required', 'integer', 'min:0', 'max:49'],
            'proxy_filter_rules.*.field' => ['required', Rule::in(['country_code', 'group'])],
            'proxy_filter_rules.*.operator' => ['required', Rule::in(['equals', 'not_equals'])],
            'proxy_filter_rules.*.value' => ['required', 'string', 'max:255'],
            'repo_link' => ['required_if:source_type,repository', 'nullable', 'array'],
            'repo_link.integration_id' => [
                'required_with:repo_link',
                'string',
                Rule::exists('integrations', 'id')->where('workspace_id', $workspaceId),
            ],
            'repo_link.repo_full_name' => ['required_with:repo_link', 'string'],
            'repo_link.branch' => ['required_with:repo_link', 'string'],
            'repo_link.file_path' => ['nullable', 'string'],
        ];
    }
}
