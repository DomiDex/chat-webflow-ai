Clean TypeScript Coding Rules
These rules aim to improve code quality, maintainability, readability, and collaboration when working with TypeScript, particularly within an environment like Cursor.ai.

1. Embrace Static Typing:

Rule: Always define types for function parameters, return values, and variables where type inference isn't obvious or sufficient. Enable strict type checking in your tsconfig.json ("strict": true).

Benefit: Catches errors early, improves code clarity and self-documentation, enhances refactoring safety.

2. Leverage Type Inference (Wisely):

Rule: Allow TypeScript to infer types for simple variable initializations where the type is clear (e.g., const name = "Alice";). Avoid redundant type annotations.

Benefit: Reduces verbosity without sacrificing type safety for straightforward cases.

3. Use Interfaces for Contracts:

Rule: Define object shapes and contracts using interface. Prefer interfaces over type aliases for defining object structures or implementing class contracts. Use type for unions, intersections, or more complex type manipulations.

Benefit: Enhances code readability, ensures consistency, and facilitates better collaboration by defining clear APIs.

4. Employ Generics for Reusability:

Rule: Use generics (<T>) to create reusable components (functions, classes, interfaces) that can work over a variety of types while maintaining type safety.

Benefit: Increases code scalability and reusability, reduces code duplication.

5. Utilize Union and Intersection Types:

Rule: Use union types (|) when a value can be one of several types. Use intersection types (&) to combine multiple types into one.

Benefit: Provides flexibility and allows for precise type definitions that accurately model complex data structures.

6. Prefer Enums for Named Constants:

Rule: Use enum for sets of named constants (e.g., status codes, fixed options) where the values have specific meanings. Consider const enum for performance-critical code where inlining is desired.

Benefit: Improves code readability and maintainability compared to magic strings or numbers.

7. Use Decorators Sparingly:

Rule: Apply decorators for metaprogramming tasks like adding metadata, modifying class/method behavior (e.g., logging, dependency injection) when they genuinely simplify the code. Understand their experimental nature and potential impact.

Benefit: Can provide elegant solutions for cross-cutting concerns, enhancing extensibility.

8. Organize with Modules:

Rule: Use ES modules (import/export) for code organization. Avoid namespace unless working with legacy code or specific global scenarios. Keep related code within the same module/file.

Benefit: Improves scalability, prevents naming collisions, and makes the codebase easier to navigate.

9. Follow Consistent Naming Conventions:

Rule:

PascalCase for types (classes, interfaces, enums, type aliases).

camelCase for variables, functions, methods, parameters, and properties.

UPPER_SNAKE_CASE for constants (especially enum members if not using default numeric values).

Avoid using I prefix for interfaces (e.g., use User instead of IUser).

Be descriptive and avoid abbreviations where possible.

Benefit: Enhances readability and consistency across the codebase.

10. Enforce Code Style with Linters/Formatters:

Rule: Integrate and configure tools like ESLint (with @typescript-eslint/parser and relevant plugins) and Prettier. Define rules (or use established presets like eslint:recommended, plugin:@typescript-eslint/recommended) and enforce them automatically (e.g., format on save).

Benefit: Ensures consistent code style, catches potential issues, and reduces cognitive load during code reviews.

11. Write Pure Functions and Embrace Immutability:

Rule: Prefer pure functions (output depends only on input, no side effects). Avoid mutating data directly; create new instances instead (e.g., use spread syntax ... for objects/arrays, or libraries like Immer).

Benefit: Leads to more predictable, testable, and maintainable code, simplifying state management.

12. Apply SOLID Principles:

Rule: Strive to follow SOLID principles (Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion) where applicable.

Benefit: Creates more modular, flexible, and maintainable object-oriented designs.

13. Keep Functions Small and Focused:

Rule: Aim for small functions that do one thing well (Single Responsibility Principle at the function level). While there's no strict line limit, functions exceeding ~20-30 lines often indicate they could be broken down.

Benefit: Improves readability, testability, and reusability.

14. Document Complex Logic:

Rule: Use comments (// or /\* _/) to explain why something is done, not what it does (the code should explain the what). Use TSDoc comments (/\*\* ... _/) for documenting functions, classes, and interfaces for better tooling support (e.g., IntelliSense).

Benefit: Helps other developers (and your future self) understand complex or non-obvious parts of the code.

15. Configure tsconfig.json Strictly:

Rule: Enable strict flags (strict, noImplicitAny, strictNullChecks, noUnusedLocals, noUnusedParameters, etc.) in your tsconfig.json.

Benefit: Catches a wide range of potential errors at compile time.
