# test-anywhere Issues Report

This document lists verified issues found while migrating deduplino tests from Bun's native test framework to test-anywhere v0.5.0.

## Environment

- **test-anywhere version**: 0.5.0
- **Runtime**: Bun v1.3.2
- **Project**: deduplino
- **Test files**: 4 files, 82 tests total

## Issue Summary

All issues are related to the `expect()` API. The test-anywhere documentation claims to support "Bun/Jest Style" assertions with `expect()`, but several commonly-used matchers are not implemented.

## Verified Issues

### 1. `expect().not.toThrow()` is not supported

**Status**: ❌ Not implemented

**Error**:
```
TypeError: expect(() => {
  analyzeEdgeCases(edgeCases);
}).not.toThrow is not a function. (In 'expect(() => {
  analyzeEdgeCases(edgeCases);
}).not.toThrow()', 'expect(() => {
  analyzeEdgeCases(edgeCases);
}).not.toThrow' is undefined)
```

**Affected Files**:
- `tests/edge-cases-detector.test.ts:87-92`
- `tests/edge-cases-detector.test.ts:104-110`

**Original Code**:
```typescript
expect(() => {
  analyzeEdgeCases(edgeCases);
}).not.toThrow();
```

**Workaround**:
```typescript
// Just call the function directly
analyzeEdgeCases(edgeCases);
```

**Notes**: While `expect().toThrow()` works correctly, the negated version `.not.toThrow()` is not implemented.

---

### 2. `expect().toBeGreaterThan()` is not supported

**Status**: ❌ Not implemented

**Error**:
```
TypeError: expect(edgeCases.length).toBeGreaterThan is not a function. (In 'expect(edgeCases.length).toBeGreaterThan(0)', 'expect(edgeCases.length).toBeGreaterThan' is undefined)
```

**Affected Files**:
- `tests/edge-cases-detector.test.ts:153-157`

**Original Code**:
```typescript
expect(edgeCases.length).toBeGreaterThan(0);
```

**Workaround**:
```typescript
expect(edgeCases.length > 0).toBe(true);
```

---

### 3. `expect().toBeGreaterThanOrEqual()` is not supported

**Status**: ❌ Not implemented

**Error**:
```
TypeError: expect(result.patternsApplied).toBeGreaterThanOrEqual is not a function. (In 'expect(result.patternsApplied).toBeGreaterThanOrEqual(1)', 'expect(result.patternsApplied).toBeGreaterThanOrEqual' is undefined)
```

**Affected Files**:
- `tests/error-conditions.test.ts:60-62`

**Original Code**:
```typescript
expect(result.patternsApplied).toBeGreaterThanOrEqual(1);
```

**Workaround**:
```typescript
expect(result.patternsApplied >= 1).toBe(true);
```

---

## Working expect() Methods

The following `expect()` methods **do work** correctly in test-anywhere v0.5.0:

✅ `expect().toBe()`
✅ `expect().toThrow(ErrorClass)`
✅ `expect().toMatch(regex)`

## Recommendations

1. **Documentation**: Update test-anywhere documentation to clearly list which `expect()` matchers are supported
2. **Implementation**: Consider implementing these common matchers:
   - `.not.toThrow()`
   - `.toBeGreaterThan()`
   - `.toBeGreaterThanOrEqual()`
   - `.toBeLessThan()`
   - `.toBeLessThanOrEqual()`
3. **Error Messages**: Provide clearer error messages when unsupported matchers are used

## Alternative: assert API

test-anywhere also provides an `assert` API which has these methods available:
- `assert.ok(value > n)` - can replace `.toBeGreaterThan()`
- `assert.ok(value >= n)` - can replace `.toBeGreaterThanOrEqual()`

However, using `expect()` is preferred for consistency with existing Jest/Vitest/Bun test codebases.

## Migration Impact

Despite these limitations, migration was successful:
- ✅ All 82 tests pass
- ✅ Only 3 test assertions needed workarounds
- ✅ Minimal code changes (31 insertions, 21 deletions)
- ✅ Tests now work across Bun, Deno, and Node.js

## Related Links

- test-anywhere repository: https://github.com/link-foundation/test-anywhere
- Migration commit: `4e8f931`
