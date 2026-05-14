import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from "@aws-sdk/client-lambda";
import { Logger } from "../util/logger";
import { TriggerDef } from "../types";
import { UnexpectedLambdaException } from "../errors";

export interface LambdaInvoker {
  invoke(
    def: TriggerDef,
    event: Record<string, unknown>
  ): Promise<Record<string, unknown>>;
}

/**
 * HTTP-based Lambda invoker. POSTs the Lambda event payload to the configured
 * endpoint. The endpoint must respond with the trigger response shape (e.g.
 * `{ response: { autoConfirmUser: true } }`).
 */
export class HttpLambdaInvoker implements LambdaInvoker {
  constructor(private logger: Logger) {}

  async invoke(
    def: TriggerDef,
    event: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (def.type !== "http") {
      throw new UnexpectedLambdaException("Expected HTTP trigger def");
    }
    this.logger.debug(
      { endpoint: def.endpoint, triggerSource: event.triggerSource },
      "Invoking HTTP trigger"
    );
    try {
      const res = await fetch(def.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        throw new UnexpectedLambdaException(
          `HTTP trigger returned ${res.status}`
        );
      }
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      this.logger.error({ err }, "HTTP trigger failed");
      throw new UnexpectedLambdaException(
        err instanceof Error ? err.message : "HTTP trigger failure"
      );
    }
  }
}

/**
 * AWS SDK v3 Lambda invoker. Uses the default credential provider chain so
 * AWS_PROFILE, env vars, and instance roles all work (fixes upstream #273).
 */
export class AwsLambdaInvoker implements LambdaInvoker {
  private client: LambdaClient;

  constructor(
    private logger: Logger,
    region: string,
    endpoint?: string
  ) {
    this.client = new LambdaClient({
      region,
      endpoint, // optional — for localstack / dev-mode pointing at local lambda
    });
  }

  async invoke(
    def: TriggerDef,
    event: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (def.type !== "lambda") {
      throw new UnexpectedLambdaException("Expected lambda trigger def");
    }
    this.logger.debug(
      { arn: def.arn, triggerSource: event.triggerSource },
      "Invoking AWS Lambda trigger"
    );
    try {
      const out = await this.client.send(
        new InvokeCommand({
          FunctionName: def.arn,
          Payload: Buffer.from(JSON.stringify(event)),
          InvocationType: InvocationType.RequestResponse,
        })
      );
      if (out.FunctionError) {
        const errBody = out.Payload
          ? Buffer.from(out.Payload).toString("utf8")
          : "(no payload)";
        throw new UnexpectedLambdaException(
          `Lambda returned FunctionError: ${out.FunctionError} ${errBody}`
        );
      }
      const payload = out.Payload
        ? JSON.parse(Buffer.from(out.Payload).toString("utf8"))
        : {};
      return payload as Record<string, unknown>;
    } catch (err) {
      this.logger.error({ err }, "AWS Lambda trigger failed");
      throw new UnexpectedLambdaException(
        err instanceof Error ? err.message : "AWS Lambda trigger failure"
      );
    }
  }
}

/**
 * Dispatcher — picks the invoker based on the trigger def type.
 */
export class TriggerInvoker {
  constructor(
    private http: HttpLambdaInvoker,
    private aws: AwsLambdaInvoker
  ) {}

  invoke(
    def: TriggerDef,
    event: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (def.type === "http") return this.http.invoke(def, event);
    return this.aws.invoke(def, event);
  }
}
