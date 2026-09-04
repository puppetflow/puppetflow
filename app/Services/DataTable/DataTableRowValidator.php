<?php

namespace App\Services\DataTable;

use App\Enums\DataTableColumnType;
use App\Models\DataTable;
use App\Models\DataTableColumn;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

final class DataTableRowValidator
{
    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    public function validate(DataTable $table, array $values, bool $partial = false): array
    {
        return $this->validateAgainstColumns($table->columns()->get(), $values, $partial);
    }

    /**
     * @param  array<array-key, mixed>  $values
     * @return array<string, mixed>
     */
    public function validateNamed(DataTable $table, array $values, bool $partial = false): array
    {
        return $this->validateNamedAgainstColumns($table->columns()->get(), $values, $partial);
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    public function validateMany(DataTable $table, array $rows): array
    {
        $columns = $table->columns()->get();

        $normalized = [];
        foreach ($rows as $index => $values) {
            try {
                $normalized[] = $this->validateAgainstColumns($columns, $values);
            } catch (ValidationException $exception) {
                $errors = [];
                foreach ($exception->errors() as $key => $messages) {
                    $errors["rows.{$index}.{$key}"] = $messages;
                }

                throw ValidationException::withMessages($errors);
            }
        }

        return $normalized;
    }

    /**
     * @param  list<array<array-key, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    public function validateManyNamed(DataTable $table, array $rows): array
    {
        $columns = $table->columns()->get();
        $normalized = [];

        foreach ($rows as $index => $values) {
            try {
                $normalized[] = $this->validateNamedAgainstColumns($columns, $values);
            } catch (ValidationException $exception) {
                $errors = [];
                foreach ($exception->errors() as $key => $messages) {
                    $errors["rows.{$index}.{$key}"] = $messages;
                }

                throw ValidationException::withMessages($errors);
            }
        }

        return $normalized;
    }

    /**
     * @param  Collection<int, DataTableColumn>  $columnModels
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function validateAgainstColumns(
        Collection $columnModels,
        array $values,
        bool $partial = false,
    ): array {
        $columns = $columnModels->keyBy(fn (DataTableColumn $column): string => (string) $column->id);
        $unknown = array_diff(array_keys($values), $columns->keys()->all());
        $reserved = array_intersect(array_map('strtolower', array_keys($values)), ['id', 'created_at', 'updated_at']);

        if ($unknown !== [] || $reserved !== []) {
            throw ValidationException::withMessages([
                'values' => 'The row contains unknown or reserved columns.',
            ]);
        }

        $normalized = [];
        foreach ($columns as $column) {
            $columnId = (string) $column->id;
            if (! array_key_exists($columnId, $values)) {
                if (! $partial) {
                    $normalized[$column->name] = null;
                }

                continue;
            }

            $normalized[$column->name] = $this->normalize($column, $values[$columnId]);
        }

        return $normalized;
    }

    /**
     * @param  Collection<int, DataTableColumn>  $columnModels
     * @param  array<array-key, mixed>  $values
     * @return array<string, mixed>
     */
    private function validateNamedAgainstColumns(
        Collection $columnModels,
        array $values,
        bool $partial = false,
    ): array {
        $valueKeys = array_keys($values);
        if (array_filter($valueKeys, fn (mixed $name): bool => ! is_string($name)) !== []) {
            throw ValidationException::withMessages([
                'values' => 'Data table column names must be strings.',
            ]);
        }

        /** @var list<string> $stringKeys */
        $stringKeys = $valueKeys;
        $normalizedKeys = array_map('strtolower', $stringKeys);
        if (count(array_unique($normalizedKeys)) !== count($normalizedKeys)) {
            throw ValidationException::withMessages([
                'values' => 'Data table column names must be unique ignoring case.',
            ]);
        }
        $providedKeys = array_combine($normalizedKeys, $stringKeys);

        $columns = $columnModels->keyBy(
            fn (DataTableColumn $column): string => strtolower($column->name),
        );
        $reserved = array_intersect($normalizedKeys, ['id', 'created_at', 'updated_at']);
        $unknown = array_filter(
            $stringKeys,
            fn (string $name): bool => ! $columns->has(strtolower($name)),
        );

        if ($unknown !== [] || $reserved !== []) {
            throw ValidationException::withMessages([
                'values' => 'The row contains unknown or reserved columns.',
            ]);
        }

        $normalized = [];
        foreach ($columns as $column) {
            $matchingKey = $providedKeys[strtolower($column->name)] ?? null;

            if ($matchingKey === null) {
                if (! $partial) {
                    $normalized[$column->name] = null;
                }

                continue;
            }

            $normalized[$column->name] = $this->normalize($column, $values[$matchingKey]);
        }

        return $normalized;
    }

    private function normalize(DataTableColumn $column, mixed $value): mixed
    {
        if ($value === null) {
            return null;
        }

        return match ($column->type) {
            DataTableColumnType::STRING => $this->stringValue($column, $value),
            DataTableColumnType::NUMBER => $this->numberValue($column, $value),
            DataTableColumnType::BOOLEAN => $this->booleanValue($column, $value),
            DataTableColumnType::DATETIME => $this->datetimeValue($column, $value),
        };
    }

    private function stringValue(DataTableColumn $column, mixed $value): string
    {
        if (! is_string($value)) {
            $this->invalid($column, 'a string');
        }

        return $value;
    }

    private function numberValue(DataTableColumn $column, mixed $value): int|float
    {
        if (! is_int($value) && ! is_float($value)) {
            $this->invalid($column, 'a number');
        }

        if (! is_finite((float) $value)) {
            $this->invalid($column, 'a finite number');
        }

        return $value;
    }

    private function booleanValue(DataTableColumn $column, mixed $value): bool
    {
        if (! is_bool($value)) {
            $this->invalid($column, 'a boolean');
        }

        return $value;
    }

    private function datetimeValue(DataTableColumn $column, mixed $value): string
    {
        if (! is_string($value)) {
            $this->invalid($column, 'an ISO 8601 datetime');
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/', $value) !== 1) {
            $this->invalid($column, 'an ISO 8601 datetime');
        }

        try {
            return Carbon::parse($value)->utc()->toIso8601String();
        } catch (\Throwable) {
            $this->invalid($column, 'an ISO 8601 datetime');
        }
    }

    private function invalid(DataTableColumn $column, string $expected): never
    {
        throw ValidationException::withMessages([
            "values.{$column->name}" => "The {$column->name} value must be {$expected}.",
        ]);
    }
}
