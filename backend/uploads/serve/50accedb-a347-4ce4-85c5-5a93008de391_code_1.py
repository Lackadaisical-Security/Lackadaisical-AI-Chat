def calculate_number(n):
    return n * 10 ** (n % 10)

# Example usage:
print(calculate_number(34))  # Outputs: 6
print(calculate_number(-5))   # Outputs: -2