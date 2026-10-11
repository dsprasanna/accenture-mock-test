# Coding round reference solutions

Use these solutions to test the coding section after submitting your own attempt. The local demo currently checks visible patterns; production grading should use the server-side Piston/SQL evaluator described in `README.md`.

## Programming Problem 1: first sufficient house

The supplied resource version is in `accenture_resources/acc_coding/acc_coding_que.py` and `.c`.

### Python

```python
r = int(input())
unit = int(input())
n = int(input())
arr = list(map(int, input().split()))

def calculate(r, unit, arr, n):
    if n == 0:
        return -1
    required = r * unit
    total = 0
    for index, food in enumerate(arr[:n], start=1):
        total += food
        if total >= required:
            return index
    return 0

print(calculate(r, unit, arr, n))
```

### Java

```java
import java.util.*;

class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int residents = scanner.nextInt();
        int unit = scanner.nextInt();
        int n = scanner.nextInt();
        int required = residents * unit;
        int total = 0;
        int answer = n == 0 ? -1 : 0;

        for (int index = 1; index <= n; index++) {
            total += scanner.nextInt();
            if (answer == 0 && total >= required) {
                answer = index;
            }
        }
        System.out.println(answer);
    }
}
```

Example: `2, 3, 4, [2, 3, 4, 1]` produces `3`.

## Programming Problem 2: binary expression

This follows the supplied `OperationsBinaryString` resource pattern. `A` is AND, `B` is OR, and `C` is XOR.

### Python

```python
expression = input().strip()
result = int(expression[0])

for index in range(1, len(expression), 2):
    operator = expression[index]
    value = int(expression[index + 1])
    if operator == "A":
        result &= value
    elif operator == "B":
        result |= value
    else:
        result ^= value

print(result)
```

### Java

```java
import java.util.*;

class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String expression = scanner.nextLine().trim();
        int result = expression.charAt(0) - '0';

        for (int index = 1; index < expression.length(); index += 2) {
            char operator = expression.charAt(index);
            int value = expression.charAt(index + 1) - '0';
            if (operator == 'A') {
                result &= value;
            } else if (operator == 'B') {
                result |= value;
            } else {
                result ^= value;
            }
        }
        System.out.println(result);
    }
}
```

Example: `1C0B1` produces `1`.

## SQL Problem: high-value customers

The query must count only completed orders, group by customer, keep totals of at least 1000, and sort descending.

```sql
SELECT customer_id,
       SUM(amount) AS total_value
FROM orders
WHERE status = 'completed'
GROUP BY customer_id
HAVING SUM(amount) >= 1000
ORDER BY total_value DESC;
```

Expected sample result:

```text
2 | 1800
1 | 1200
```

A production evaluator should run this against a disposable, read-only database containing only the task tables.

## Web Development Problem: registration form

The HTML/CSS/JavaScript editors can be tested with this reference implementation.

### HTML

```html
<form id="registration-form">
  <label>Name <input id="name" required /></label>
  <label>Email <input id="email" type="email" required /></label>
  <label>Password <input id="password" type="password" required /></label>
  <button type="submit">Register</button>
  <p id="message" aria-live="polite"></p>
</form>
```

### CSS

```css
body {
  font-family: sans-serif;
  padding: 24px;
}

form {
  display: grid;
  gap: 12px;
  max-width: 360px;
}

input,
button {
  padding: 10px;
}
```

### JavaScript

```javascript
const form = document.querySelector("#registration-form");
const message = document.querySelector("#message");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = document.querySelector("#email").value.trim();
  const name = document.querySelector("#name").value.trim();
  const password = document.querySelector("#password").value;

  if (!name || !email.includes("@") || !password) {
    message.textContent = "Please complete all fields.";
    return;
  }

  message.textContent = "Registration complete";
});
```

## Quick test inputs

- Problem 1: `2`, `3`, `4`, `2 3 4 1` -> `3`
- Problem 1 insufficient food: `5`, `2`, `3`, `1 1 1` -> `0`
- Problem 2: `1C0B1` -> `1`
- Problem 2: `1A1C0` -> `1`
- SQL: use the sample result above
- Web: Maya / `maya@example.com` / `123456` -> `Registration complete`
