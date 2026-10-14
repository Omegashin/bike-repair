// Public ticket numbers, written on the bike tag and typed in by customers.
// Uppercase letters and digits without look-alikes (0/O, 1/I/L), so they survive handwriting.
export const TICKET_NUMBER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const TICKET_NUMBER_LENGTH = 6;
export const TICKET_NUMBER_PATTERN = /^[2-9ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

// Random, not sequential, so numbers don't reveal volume or neighbouring tickets.
// The caller retries on the rare collision (31^6 ≈ 887 million numbers).
export function generateTicketNumber(): string {
  const size = TICKET_NUMBER_ALPHABET.length;
  // Reject bytes past the last full multiple of the alphabet size, so every character is equally likely.
  const limit = 256 - (256 % size);
  let number = "";
  while (number.length < TICKET_NUMBER_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte < limit && number.length < TICKET_NUMBER_LENGTH)
        number += TICKET_NUMBER_ALPHABET[byte % size];
    }
  }
  return number;
}
