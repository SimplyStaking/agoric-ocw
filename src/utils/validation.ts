/**
 * Function to validate since parameter for API
 * @param since Date timestamp in string
 * @returns true or false, whether it is successful
 */
function validateSince(since: string) {
    return isNaN(Number(since))
}