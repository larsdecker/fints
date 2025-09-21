# fints-cli

[![npm](https://img.shields.io/npm/v/fints-cli.svg)](https://www.npmjs.com/package/fints-cli)
[![pipeline status](https://gitlab.com/prior99/fints/badges/master/pipeline.svg)](https://github.com/Prior99/fints)
[![coverage report](https://gitlab.com/prior99/fints/badges/master/coverage.svg)](https://github.com/Prior99/fints)


A command line interface for communicating with [FinTS servers](https://www.hbci-zka.de/).


## Features

- Load list of accounts.
- Load list of transactions in specified range.
- Fetch the current balance for an account.
- List holdings for depot accounts.
- Submit SEPA credit transfers.
- Submit SEPA direct debits.

### List accounts

```
  List the accounts available for the specified user.

  USAGE

    fints list-accounts --url <url> --name <name> --pin <pin> --blz <blz> [...options]

  OPTIONS

    -u, --url <url>   - Endpoint URL.                
    -n, --name <name> - Username used for connecting. 
    -p, --pin <pin>   - Pin used for connecting.      
    -b, --blz <blz>   - BLZ of the bank to connect to.
    -d, --debug      
    -v, --verbose    
    -j, --json       
```

```
fint-cli list-accounts --url https://example.com/fints -n username -p 12345 -b 12345678
```

### Fetching transactions

```
  Fetch the statements for a specified account.

  USAGE

    fints fetch-transactions --url <url> --name <name> --pin <pin> --blz <blz> --iban <iban> [...options]

  OPTIONS

    -u, --url <url>     - Endpoint URL.                        
    -n, --name <name>   - Username used for connecting.         
    -p, --pin <pin>     - Pin used for connecting.              
    -b, --blz <blz>     - BLZ of the bank to connect to.        
    -d, --debug        
    -v, --verbose      
    -j, --json         
    -i, --iban <iban>   - IBAN of the account to fetch.         
    -s, --start <start> - Date of earliest transaction to fetch.
    -e, --end <end>     - Date of latest transaction to fetch.  
```

```
./fints-cli fetch-transactions --url http://example.com/fints -n username -p 12345 -b 12345678 -i DE111234567800000001 -s 2018-01-01 -e 2018-10-01
```

### Fetch current balance

```
  Fetch the current balance for a specified account.

  USAGE

    fints get-balance --url <url> --name <name> --pin <pin> --blz <blz> --iban <iban> [...options]

  OPTIONS

    -u, --url <url>   - Endpoint URL.
    -n, --name <name> - Username used for connecting.
    -p, --pin <pin>   - Pin used for connecting.
    -b, --blz <blz>   - BLZ of the bank to connect to.
    -d, --debug
    -v, --verbose
    -j, --json
    -i, --iban <iban> - IBAN of the account to fetch.
```

```
./fints-cli get-balance --url https://example.com/fints -n username -p 12345 -b 12345678 -i DE111234567800000001
```

### List holdings

```
  List the holdings of a depot account.

  USAGE

    fints list-holdings --url <url> --name <name> --pin <pin> --blz <blz> --iban <iban> [...options]

  OPTIONS

    -u, --url <url>   - Endpoint URL.
    -n, --name <name> - Username used for connecting.
    -p, --pin <pin>   - Pin used for connecting.
    -b, --blz <blz>   - BLZ of the bank to connect to.
    -d, --debug
    -v, --verbose
    -j, --json
    -i, --iban <iban> - IBAN of the depot account to fetch.
```

```
./fints-cli list-holdings --url https://example.com/fints -n username -p 12345 -b 12345678 -i DE111234567800000001
```

### Submit a credit transfer

```
  Submit a SEPA credit transfer.

  USAGE

    fints submit-credit-transfer --url <url> --name <name> --pin <pin> --blz <blz> --iban <iban> --debtor-name <debtor> --creditor-name <creditor> --creditor-iban <iban> --creditor-bic <bic> --amount <amount> [...options]

  OPTIONS

    -u, --url <url>               - Endpoint URL.
    -n, --name <name>             - Username used for connecting.
    -p, --pin <pin>               - Pin used for connecting.
    -b, --blz <blz>               - BLZ of the bank to connect to.
    --iban <iban>                 - IBAN of the account to debit.
    --debtor-name <name>          - Name of the account holder.
    --creditor-name <name>        - Name of the beneficiary.
    --creditor-iban <iban>        - Beneficiary IBAN.
    --creditor-bic <bic>          - Beneficiary BIC.
    --amount <amount>             - Amount to transfer.
    --currency <currency>         - Currency (default EUR).
    --remittance <text>           - Unstructured remittance text.
    --end-to-end-id <id>          - Optional end-to-end identifier.
    --schema <pain version>       - pain.001 schema (default pain.001.003.03).
    --message-id <id>             - Optional custom message identifier.
    --payment-information-id <id> - Optional custom payment information identifier.
    --execution-date <date>       - Requested execution date (YYYY-MM-DD).
    --charge-bearer <code>        - Charge bearer indicator.
    --tan <value>                 - Provide a TAN to finalize a pending transfer.
    --transaction-reference <id>  - Reference received when TAN was requested.
    --dialog <base64>             - Dialog state (base64) returned when TAN was requested.
    -d, --debug
    -v, --verbose
    -j, --json
```

```
./fints-cli submit-credit-transfer --url https://example.com/fints -n username -p 12345 -b 12345678 --iban DE111234567800000001 --debtor-name "Alice Example" --creditor-name "Bob Receiver" --creditor-iban DE44123456781234567890 --creditor-bic BANKDEBBXXX --amount 12.34 --remittance "Invoice 2024/07"
```

If a TAN is required the command prints the challenge text, the transaction reference, and a base64 encoded dialog state. Rerun the command with `--tan`, `--transaction-reference`, and `--dialog` using the values returned in the first step. Include the `--message-id` and `--payment-information-id` if they were part of the response to ensure the original pain.001 identifiers are reused.

### Submit a direct debit

```
  Submit a SEPA direct debit request.

  USAGE

    fints submit-direct-debit --url <url> --name <name> --pin <pin> --blz <blz> --account-iban <iban> --creditor-name <name> \
      --creditor-id <id> --debtor-name <name> --debtor-iban <iban> --amount <amount> --mandate-id <id> --mandate-date <date> \
      --collection-date <date> [...options]

  OPTIONS

    -u, --url <url>              - Endpoint URL.
    -n, --name <name>            - Username used for connecting.
    -p, --pin <pin>              - Pin used for connecting.
    -b, --blz <blz>              - BLZ of the bank to connect to.
    --account-iban <iban>        - IBAN of the creditor account.
    --creditor-name <name>       - Name of the creditor.
    --creditor-id <id>           - SEPA creditor identifier.
    --debtor-name <name>         - Name of the debtor.
    --debtor-iban <iban>         - IBAN of the debtor.
    --amount <amount>            - Amount to collect.
    --mandate-id <id>            - SEPA mandate identifier.
    --mandate-date <date>        - Mandate signature date (YYYY-MM-DD).
    --collection-date <date>     - Requested collection date (YYYY-MM-DD).
    --sequence-type <type>       - Sequence type (OOFF, FRST, RCUR, FNAL).
    --local-instrument <code>    - Local instrument (CORE or B2B).
    --end-to-end-id <id>         - End-to-end reference.
    --remittance <text>          - Unstructured remittance information.
    --purpose-code <code>        - Purpose code for the debit.
    --message-id <id>            - Optional message identifier.
    --payment-information-id <id>- Optional payment information identifier.
    --batch                      - Request batch booking.
    --tan <tan>                  - Provide TAN to skip the interactive prompt.
    -d, --debug
    -v, --verbose
    -j, --json
```

```
./fints-cli submit-direct-debit --url https://example.com/fints --name username --pin 12345 --blz 12345678 \
  --account-iban DE111234567800000001 --creditor-name "ACME GmbH" --creditor-id DE98ZZZ09999999999 \
  --debtor-name "John Doe" --debtor-iban DE02120300000000202051 --amount 42.50 --mandate-id MANDATE-123 \
  --mandate-date 2022-01-10 --collection-date 2022-01-15 --remittance "Invoice 0815"
```

When a TAN is required the command prints the challenge text and transaction reference. Rerun the command with `--tan` using the challenge value to finalize the submission. The CLI also resumes using the stored message identifier details so the bank receives the original pain.008 payload metadata.
## Resources

- [Database of banks with their URLs](https://github.com/jhermsmeier/fints-institute-db)
