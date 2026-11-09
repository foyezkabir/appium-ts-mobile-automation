import { faker } from '@faker-js/faker';

// Fixed literal = the app's own vocabulary, asserted against. DataHelper = input
// the app stores or validates. Env var = a real account or a real phone.
// A hardcoded "wrong password" on PRODUCTION can one day become a real one.

export class DataHelper {
    static uid(): string {
    return `${Date.now().toString(36)}-${faker.string.alphanumeric(6)}`;
  }

    static tag(): string {
    return `${Date.now().toString(36).slice(-4)}${faker.string.alphanumeric(4)}`;
  }

    static personName(): string {
    return `${faker.person.fullName()} ${DataHelper.tag()}`;
  }

    static email(domain = 'example.test'): string {
    let local = faker.internet.username().toLowerCase().replace(/[^a-z0-9.]/g, '');
    return `qa.${local}.${DataHelper.tag()}@${domain}`;
  }

    static numericId(length = 10): string {
    return faker.string.numeric(length);
  }

    static phone(prefix = '01', operators = ['3', '4', '5', '6', '7', '8', '9'], digits = 8): string {
    return `${prefix}${faker.helpers.arrayElement(operators)}${faker.string.numeric(digits)}`;
  }

    static firstName(): string {
    return faker.person.firstName();
  }

    static lastName(): string {
    return faker.person.lastName();
  }

    static address(): string {
    let area = faker.helpers.arrayElement(['Dhanmondi', 'Gulshan', 'Banani', 'Uttara', 'Mirpur', 'Mohammadpur']);
    return `House ${faker.number.int({ min: 1, max: 120 })}, Road ${faker.number.int({ min: 1, max: 32 })}, ${area}, Dhaka`;
  }

    static dateOfBirth(minAge = 20, maxAge = 60): Date {
    return faker.date.birthdate({ mode: 'age', min: minAge, max: maxAge });
  }

    static decimal(min: number, max: number): number {
    return faker.number.float({ min, max, fractionDigits: 1 });
  }

    static pick<T>(values: readonly T[]): T {
    return faker.helpers.arrayElement(values);
  }

    static pickSome<T>(values: readonly T[], count: number): T[] {
    return faker.helpers.arrayElements([...values], count);
  }

  // Meets the app's only rule (8+ characters) with every character class, so a
  // stricter server rule added later cannot turn a valid change into a refusal.
    static password(): string {
    return `${faker.string.alpha({ length: 3, casing: 'upper' })}${faker.string.alpha({ length: 4, casing: 'lower' })}${faker.string.numeric(3)}#`;
  }

    static unique(label: string, prefix = 'QA-AUTO'): string {
    return `${prefix} ${label} ${DataHelper.uid()}`;
  }
}
