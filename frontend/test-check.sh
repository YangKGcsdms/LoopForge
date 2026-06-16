#!/bin/bash
set -e

echo "=== Testing WorkflowResults Refactor ==="
echo ""

# Check if files exist
echo "Checking files..."
test -f "src/components/WorkflowResults.vue" && echo "✓ WorkflowResults.vue exists" || echo "✗ WorkflowResults.vue missing"
test -f "src/components/BaseCard.vue" && echo "✓ BaseCard.vue exists" || echo "✗ BaseCard.vue missing"

echo ""
echo "Running TypeScript check..."
npx vue-tsc --noEmit && echo "✓ TypeScript check passed" || echo "✗ TypeScript check failed"

echo ""
echo "Running Workflow tests..."
node --import tsx --test src/components/__tests__/Workflow.test.ts && echo "✓ All tests passed" || echo "✗ Some tests failed"

echo ""
echo "=== Verification Complete ==="
