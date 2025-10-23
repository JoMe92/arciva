# AGENTS.md

 This document provides recommended steps for the OpenAI Codex assistant when making changes 
 
## 🧠 Architectural Principles

- **Decoupled Frontend and Backend**:
  - The frontend communicates with the backend via REST APIs (or GraphQL if applicable).
  - Cross-cutting concerns (e.g. authentication, logging) are handled on the backend.
- **Separation of Concerns**:
  - Business logic is not embedded in UI components or API handlers.
  - Use a service/repository pattern in the backend, and a component/container pattern in the frontend.
- **Reusable Modules**:
  - Write code that is modular and reusable across features.
- **Environment Variables**:
  - All secrets and configurations must use `.env` files and never be hardcoded.
- **Documentation**:
  - Update or create documentation for any public API changes (backend) or UI workflows (frontend).

---

## 🧑‍💻 React Programming Guidelines

- **Component Structure**:
  - Use **functional components** only.
  - Use **hooks** (`useState`, `useEffect`, `useReducer`, etc.) for state and lifecycle.
  - Separate **UI components** from **logic containers** where possible.
- **Styling**:
  - Prefer CSS Modules, TailwindCSS, or styled-components. Follow the project’s chosen convention.
- **Code Style**:
  - Max line length: **100 characters**
  - Indentation: **2 spaces**
  - Prefer `const` over `let`; never use `var`.
  - Use `camelCase` for variables/functions and `PascalCase` for components.
- **Patterns**:
  - Avoid prop drilling; use Context API or composition.
  - Avoid anonymous inline functions when unnecessary.
  - Memoize expensive functions with `useMemo` and `useCallback`.
  - Lazy-load routes or components when needed.
- **Testing**:
  - Use **Jest** and **React Testing Library**.
  - Write tests for components, hooks, and services.
  - Prefer behavioral tests over snapshot tests.

---
### 🐍 Python / FastAPI Programming Guidelines

- **Language Features**:
  - Use **Python 3.10+** features such as structural pattern matching and modern typing syntax (`list[int]` instead of `List[int]`).
  - **All functions and methods must use type annotations**.
  - Avoid using `Any` unless absolutely necessary.

- **Structure & Conventions**:
  - Use `snake_case` for variables and functions.
  - Use `PascalCase` for class names.
  - Max line length: **100 characters**
  - Indentation: **4 spaces**
  - Business logic must live in `services/` layer, not in `routes/`.
  - Organize backend into clear domains: `routers/`, `services/`, `models/`, `schemas/`.

- **Logging**:
  - Use Python’s built-in `logging` module instead of `print`.
  - Configure logging centrally and avoid repeating setup in each module.
  - Log warnings, errors, and critical info where needed.
  - Do not log sensitive data (passwords, tokens, etc.).

- **Error Handling**:
  - Use `try`/`except` blocks around risky operations.
  - Raise `HTTPException` with proper status codes for API-level errors.
  - Wrap lower-level exceptions to provide meaningful API messages.
  - Avoid exposing internal exception details to the user.

- **Documentation**:
  - **Every function, method, and class must include a docstring using the NumPy Styleguide**:
    - Describe parameters, return types, exceptions, and purpose clearly.
    - Example:
      ```python
      def calculate_total(price: float, tax: float) -> float:
          """
          Calculate the total price including tax.

          Parameters
          ----------
          price : float
              The base price of the item.
          tax : float
              Tax rate to apply.

          Returns
          -------
          float
              Total price after applying tax.
          """
          return price * (1 + tax)
      ```
  - Docstrings are mandatory for:
    - All public functions and methods
    - All classes and modules
    - Private methods if they contain logic beyond simple return

- **Code Style**:
  - Use [**black**](https://black.readthedocs.io/) for consistent formatting.
  - Lint with **ruff** or **flake8**.
  - Type check with **mypy**.
  - No global mutable state.
  - Use `dataclass` or `pydantic.BaseModel` where applicable.

- **Testing**:
  - Use **pytest**
  - Write both **unit tests** and **integration tests**.
  - Use `pytest-mock` or `unittest.mock` to isolate external dependencies.
  - Validate response codes, data shape, and behavior under error conditions.


## ✅ Testing Requirements

- All code must be covered with automated tests.
- For backend:
  - Run tests with `pytest --cov=app`
- For frontend:
  - Use `npm test` or `vitest` depending on the stack.
- Snapshot tests (frontend) must be reviewed and accepted manually when changed.
- Avoid blind test coverage; write meaningful assertions.
- CI must pass before merging.

---

## 📝 Commit Messages

Every code change must conclude with a commit that follows the **Conventional Commits** standard:

<type>(<scope>): <short summary>

[Optional body]

[Optional footer]


### Valid `<type>` values:
- `feat`: A new feature
- `fix`: A bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `docs`: Documentation only changes
- `style`: Changes that do not affect meaning (white-space, formatting)
- `test`: Adding or correcting tests
- `chore`: Build or tooling-related changes
- `perf`: Performance improvements
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI/CD configuration

### Examples:
- `feat(api): add user registration endpoint`
- `fix(ui): correct alignment issue on login page`
- `test(services): add test for order total calculation`

---

## 🔁 Workflow for Agents

1. Implement changes respecting all guidelines above.
2. Format and lint your code.
3. Run appropriate test suites (backend or frontend).
4. Ensure documentation is updated (if public APIs or UX is changed).
5. Create a single, meaningful commit using the Conventional Commits format.

