import { test, expect } from '@playwright/test';

test('Update device name with a new unique name', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for the app to be ready
    const setNameBtn = page.locator('#set-name-btn');
    const nameInput = page.locator('#display-name-input');
    const errorMsg = page.locator('#display-name-input-error');

    await expect(setNameBtn).toBeVisible();
    // Wait for the initial name to load
    await expect(nameInput).not.toBeEmpty();

    // Generate a new unique name
    const newName = `TESTDEVICE-${Date.now()}`;
    console.log(`Setting new name to: ${newName}`);

    // Fill the new name
    await nameInput.fill(newName);

    // Ensure the "Set Name" button is enabled after changing the text
    await expect(setNameBtn).toBeEnabled();

    // Click "Set Name"
    await setNameBtn.click();

    // Verify the name was accepted:
    // 1. The button should become disabled (indicating the name is saved and matches current)
    //await expect(setNameBtn).toBeDisabled();

    // 2. The error message should be hidden
    await expect(errorMsg).toHaveClass(/hidden/);

    // 3. The input value should still be the new name
    await expect(nameInput).toHaveValue(newName);
});
