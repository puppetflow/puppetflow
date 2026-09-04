<?php

use App\Http\Controllers\Api\DataTableApiController;
use App\Http\Controllers\Api\DataTableColumnApiController;
use App\Http\Controllers\Api\DataTableRowApiController;
use App\Http\Controllers\Api\FlowApiController;
use App\Http\Controllers\Api\FlowSearchApiController;
use App\Http\Controllers\Api\RunApiController;
use App\Http\Controllers\Api\TeamApiController;
use App\Http\Controllers\Api\UserApiController;
use App\Http\Controllers\Api\WorkspaceApiController;
use App\Http\Controllers\Api\WorkspaceMemberApiController;
use App\Http\Controllers\Integration\Repository\RepositoryWebhookController;
use App\Http\Controllers\Internal\MailboxRunMessageController;
use App\Http\Controllers\Internal\RunnerSignalController;
use App\Http\Controllers\Internal\RuntimeAiController;
use App\Http\Controllers\Internal\RuntimeDataTableController;
use App\Http\Controllers\Mcp\McpBrokerController;
use App\Http\Controllers\Mcp\McpServerController;
use App\Http\Controllers\Trigger\TriggerIncomingController;
use App\Http\Middleware\AuthenticateRunnerCapability;
use App\Services\Runtime\RunnerCapabilityService;
use Illuminate\Support\Facades\Route;

$triggerRateValue = config('puppetflow.trigger_rate_limit_per_minute', 120);
$triggerRateLimit = is_numeric($triggerRateValue) ? max(1, (int) $triggerRateValue) : 120;
$repositoryWebhookRateValue = config('puppetflow.repository_webhook_rate_limit_per_minute', 300);
$repositoryWebhookRateLimit = is_numeric($repositoryWebhookRateValue)
    ? max(1, (int) $repositoryWebhookRateValue)
    : 300;

Route::post('trigger/{token}', TriggerIncomingController::class)
    ->middleware("throttle:{$triggerRateLimit},1")
    ->name('trigger.incoming');

Route::post('mcp/broker/token', [McpBrokerController::class, 'token'])
    ->middleware('throttle:20,1')
    ->name('mcp.broker.token');

Route::prefix('internal/runner')
    ->name('internal.runner.')
    ->group(function () {
        Route::post('mailbox/claim', [MailboxRunMessageController::class, 'claim'])
            ->middleware(AuthenticateRunnerCapability::class.':'.RunnerCapabilityService::SCOPE_MAILBOX_CLAIM)
            ->name('mailbox.claim');
        Route::post('mailbox/renew', [MailboxRunMessageController::class, 'renew'])
            ->middleware(AuthenticateRunnerCapability::class.':'.RunnerCapabilityService::SCOPE_MAILBOX_RENEW)
            ->name('mailbox.renew');
        Route::post('ai/execute', [RuntimeAiController::class, 'execute'])
            ->middleware(AuthenticateRunnerCapability::class.':'.RunnerCapabilityService::SCOPE_AI_EXECUTE)
            ->name('ai.execute');
        Route::post('data-table/read', [RuntimeDataTableController::class, 'read'])
            ->middleware(AuthenticateRunnerCapability::class.':'.RunnerCapabilityService::SCOPE_DATA_TABLE_READ)
            ->name('data-table.read');
        Route::post('data-table/write', [RuntimeDataTableController::class, 'write'])
            ->middleware(AuthenticateRunnerCapability::class.':'.RunnerCapabilityService::SCOPE_DATA_TABLE_WRITE)
            ->name('data-table.write');
        Route::post('data-table/schema', [RuntimeDataTableController::class, 'schema'])
            ->middleware(AuthenticateRunnerCapability::class.':'.RunnerCapabilityService::SCOPE_DATA_TABLE_SCHEMA)
            ->name('data-table.schema');
        Route::post('waiting/declare', [RunnerSignalController::class, 'declareWaiting'])
            ->middleware(AuthenticateRunnerCapability::class.':'.RunnerCapabilityService::SCOPE_WAITING_DECLARE)
            ->name('waiting.declare');
        Route::post('waiting/consume', [RunnerSignalController::class, 'consumeContinuation'])
            ->middleware(AuthenticateRunnerCapability::class.':'.RunnerCapabilityService::SCOPE_WAITING_CONSUME)
            ->name('waiting.consume');
        Route::post('waiting/clear', [RunnerSignalController::class, 'clearWaiting'])
            ->middleware(AuthenticateRunnerCapability::class.':'.RunnerCapabilityService::SCOPE_WAITING_CLEAR)
            ->name('waiting.clear');
    });

Route::prefix('webhooks')
    ->name('webhooks.')
    ->middleware("throttle:{$repositoryWebhookRateLimit},1")
    ->group(function () {
        Route::post('github/{webhookId}', [RepositoryWebhookController::class, 'github'])->name('github');
        Route::post('gitlab/{webhookId}', [RepositoryWebhookController::class, 'gitlab'])->name('gitlab');
        Route::post('gitea/{webhookId}', [RepositoryWebhookController::class, 'gitea'])->name('gitea');
        Route::post('bitbucket/{webhookId}', [RepositoryWebhookController::class, 'bitbucket'])->name('bitbucket');
    });

Route::post('mcp-server/broker/revoke', [McpBrokerController::class, 'revoke'])
    ->middleware('throttle:30,1')
    ->name('mcp.broker.revoke');

Route::middleware(\App\Http\Middleware\AuthenticateMcpToken::class)
    ->prefix('mcp-server')
    ->name('mcp.')
    ->group(function () {
        Route::post('http', McpServerController::class)->name('http');
        Route::get('flows/{id}/runs/{run}/artifacts/{type}/{filename}', [McpServerController::class, 'downloadArtifact'])
            ->where('filename', '.*')
            ->name('artifacts.download');
        Route::get('flows/{id}/runs/{run}/recording', [McpServerController::class, 'downloadRecording'])->name('recording');
        Route::get('flows/{id}/runs/{run}/recording/lastshot', [McpServerController::class, 'downloadRecordingLastshot'])->name('recording.lastshot');
    });

Route::middleware(\App\Http\Middleware\AuthenticateMcpOAuth::class)
    ->prefix('workspaces/{workspace}/mcp-server')
    ->name('mcp.oauth.')
    ->group(function () {
        Route::post('http', McpServerController::class)->name('http');
        Route::get('flows/{id}/runs/{run}/artifacts/{type}/{filename}', [McpServerController::class, 'downloadArtifact'])
            ->where('filename', '.*')
            ->name('artifacts.download');
        Route::get('flows/{id}/runs/{run}/recording', [McpServerController::class, 'downloadRecording'])->name('recording');
        Route::get('flows/{id}/runs/{run}/recording/lastshot', [McpServerController::class, 'downloadRecordingLastshot'])->name('recording.lastshot');
    });

Route::middleware(\App\Http\Middleware\AuthenticateApiKey::class)
    ->prefix('v1')
    ->name('api.v1.')
    ->group(function () {
        Route::get('flows/search', [FlowSearchApiController::class, 'flows'])->name('flows.search');
        Route::get('users', [UserApiController::class, 'index'])->name('users.index');
        Route::post('users', [UserApiController::class, 'store'])->name('users.store');
        Route::get('users/{user}', [UserApiController::class, 'show'])->name('users.show');
        Route::match(['put', 'patch'], 'users/{user}', [UserApiController::class, 'update'])->name('users.update');
        Route::post('users/{user}/login-link', [UserApiController::class, 'loginLink'])->name('users.login-link');
        Route::get('workspaces', [WorkspaceApiController::class, 'index'])->name('workspaces.index');
        Route::post('workspaces', [WorkspaceApiController::class, 'store'])->name('workspaces.store');
        Route::get('workspaces/{workspace}', [WorkspaceApiController::class, 'show'])->name('workspaces.show');
        Route::match(['put', 'patch'], 'workspaces/{workspace}', [WorkspaceApiController::class, 'update'])->name('workspaces.update');
        Route::get('workspaces/{workspace}/teams', [TeamApiController::class, 'index'])->name('workspaces.teams.index');
        Route::post('workspaces/{workspace}/teams', [TeamApiController::class, 'store'])->name('workspaces.teams.store');
        Route::get('workspaces/{workspace}/members', [WorkspaceMemberApiController::class, 'index'])->name('workspaces.members.index');
        Route::post('workspaces/{workspace}/members', [WorkspaceMemberApiController::class, 'store'])->name('workspaces.members.store');
        Route::get('workspaces/{workspace}/members/{member}', [WorkspaceMemberApiController::class, 'show'])->name('workspaces.members.show');
        Route::match(['put', 'patch'], 'workspaces/{workspace}/members/{member}', [WorkspaceMemberApiController::class, 'update'])->name('workspaces.members.update');
        Route::delete('workspaces/{workspace}/members/{member}', [WorkspaceMemberApiController::class, 'destroy'])->name('workspaces.members.destroy');
        Route::get('teams/{team}', [TeamApiController::class, 'show'])->name('teams.show');
        Route::match(['put', 'patch'], 'teams/{team}', [TeamApiController::class, 'update'])->name('teams.update');
        Route::post('teams/{team}/members', [TeamApiController::class, 'addMembers'])->name('teams.members.add');
        Route::put('teams/{team}/members', [TeamApiController::class, 'replaceMembers'])->name('teams.members.replace');
        Route::put('workspaces/{workspace}/members/{member}/teams', [TeamApiController::class, 'setMemberTeams'])->name('workspaces.members.teams.replace');

        Route::get('workspaces/{workspace}/data-tables', [DataTableApiController::class, 'index'])->name('workspaces.data-tables.index');
        Route::post('workspaces/{workspace}/data-tables', [DataTableApiController::class, 'store'])->name('workspaces.data-tables.store');

        Route::prefix('data-tables')
            ->name('data-tables.')
            ->group(function () {
                Route::get('{dataTable}', [DataTableApiController::class, 'show'])->name('show');
                Route::match(['put', 'patch'], '{dataTable}', [DataTableApiController::class, 'update'])->name('update');
                Route::delete('{dataTable}', [DataTableApiController::class, 'destroy'])->name('destroy');

                Route::get('{dataTable}/columns', [DataTableColumnApiController::class, 'index'])->name('columns.index');
                Route::post('{dataTable}/columns', [DataTableColumnApiController::class, 'store'])->name('columns.store');
                Route::put('{dataTable}/columns/reorder', [DataTableColumnApiController::class, 'reorder'])->name('columns.reorder');
                Route::get('{dataTable}/columns/{column}', [DataTableColumnApiController::class, 'show'])->name('columns.show');
                Route::match(['put', 'patch'], '{dataTable}/columns/{column}', [DataTableColumnApiController::class, 'update'])->name('columns.update');
                Route::delete('{dataTable}/columns/{column}', [DataTableColumnApiController::class, 'destroy'])->name('columns.destroy');

                Route::get('{dataTable}/rows', [DataTableRowApiController::class, 'index'])->name('rows.index');
                Route::post('{dataTable}/rows', [DataTableRowApiController::class, 'store'])->name('rows.store');
                Route::patch('{dataTable}/rows', [DataTableRowApiController::class, 'updateFiltered'])->name('rows.update-filtered');
                Route::delete('{dataTable}/rows', [DataTableRowApiController::class, 'destroyFiltered'])->name('rows.destroy-filtered');
                Route::post('{dataTable}/rows/bulk', [DataTableRowApiController::class, 'storeBulk'])->name('rows.store-bulk');
                Route::post('{dataTable}/rows/upsert', [DataTableRowApiController::class, 'upsert'])->name('rows.upsert');
                Route::get('{dataTable}/rows/{row}', [DataTableRowApiController::class, 'show'])->name('rows.show');
                Route::match(['put', 'patch'], '{dataTable}/rows/{row}', [DataTableRowApiController::class, 'update'])->name('rows.update');
                Route::delete('{dataTable}/rows/{row}', [DataTableRowApiController::class, 'destroy'])->name('rows.destroy');
            });

        Route::get('flows', [FlowSearchApiController::class, 'flows'])->name('flows.index');
        Route::get('folders', [FlowSearchApiController::class, 'folders'])->name('folders.index');
        Route::get('runs/search', [FlowSearchApiController::class, 'searchRuns'])->name('runs.search');

        Route::prefix('flows/{id}')->name('flows.')->group(function () {
            Route::get('/', [FlowSearchApiController::class, 'show'])->name('show');
            Route::post('trigger', [FlowApiController::class, 'trigger'])->name('trigger');

            Route::get('runs', [RunApiController::class, 'index'])->name('runs.index');
            Route::get('runs/search', [FlowSearchApiController::class, 'runs'])->name('runs.search');
            Route::get('runs/{run}', [RunApiController::class, 'show'])->name('runs.show');
            Route::get('runs/{run}/result', [RunApiController::class, 'result'])->name('runs.result');
            Route::post('runs/{run}/continue', [RunApiController::class, 'continueRun'])->name('runs.continue');
            Route::get('runs/{run}/recording', [RunApiController::class, 'recording'])->name('runs.recording');
            Route::get('runs/{run}/recording/lastshot', [RunApiController::class, 'recordingLastshot'])->name('runs.recording.lastshot');
            Route::get('runs/{run}/artifacts/{type}', [RunApiController::class, 'artifacts'])->name('runs.artifacts');
            Route::get('runs/{run}/artifacts/{type}/{filename}', [RunApiController::class, 'downloadArtifact'])->where('filename', '.*')->name('runs.artifacts.download');
        });
    });
