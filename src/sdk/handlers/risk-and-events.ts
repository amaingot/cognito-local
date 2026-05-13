import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError } from "../../errors";
import { DataStore } from "../../data/store";
import { AuthEvent, RiskConfiguration } from "../../types";

let riskStore: DataStore<RiskConfiguration> | undefined;
let eventStore: DataStore<AuthEvent> | undefined;
function risks(ctx: AppContext): DataStore<RiskConfiguration> {
  if (!riskStore) {
    riskStore = new DataStore<RiskConfiguration>(
      ctx.config.dataDir,
      "risk-configurations.json"
    );
  }
  return riskStore;
}
function events(ctx: AppContext): DataStore<AuthEvent> {
  if (!eventStore) {
    eventStore = new DataStore<AuthEvent>(
      ctx.config.dataDir,
      "auth-events.json"
    );
  }
  return eventStore;
}
const rkey = (poolId: string, clientId?: string) =>
  `${poolId}:${clientId ?? "ALL"}`;

export function setRiskConfigurationHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      UserPoolId,
      ClientId,
      CompromisedCredentialsRiskConfiguration,
      AccountTakeoverRiskConfiguration,
      RiskExceptionConfiguration,
    } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    risks(ctx).set(rkey(UserPoolId, ClientId), {
      userPoolId: UserPoolId,
      clientId: ClientId,
      compromisedCredentialsRiskConfiguration:
        CompromisedCredentialsRiskConfiguration,
      accountTakeoverRiskConfiguration: AccountTakeoverRiskConfiguration,
      riskExceptionConfiguration: RiskExceptionConfiguration,
    });
    res.json({
      RiskConfiguration: {
        UserPoolId,
        ClientId,
        CompromisedCredentialsRiskConfiguration,
        AccountTakeoverRiskConfiguration,
        RiskExceptionConfiguration,
        LastModifiedDate: ctx.clock.now(),
      },
    });
  };
}

export function describeRiskConfigurationHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, ClientId } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    const r = risks(ctx).get(rkey(UserPoolId, ClientId));
    res.json({
      RiskConfiguration: r
        ? {
            UserPoolId: r.userPoolId,
            ClientId: r.clientId,
            CompromisedCredentialsRiskConfiguration:
              r.compromisedCredentialsRiskConfiguration,
            AccountTakeoverRiskConfiguration:
              r.accountTakeoverRiskConfiguration,
            RiskExceptionConfiguration: r.riskExceptionConfiguration,
          }
        : { UserPoolId, ClientId },
    });
  };
}

export function adminListUserAuthEventsHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username, MaxResults } = req.body;
    if (!UserPoolId || !Username) {
      throw new InvalidParameterError(
        "UserPoolId and Username are required."
      );
    }
    const user = ctx.userPoolStore.getUserByUsername(UserPoolId, Username);
    if (!user) {
      res.json({ AuthEvents: [] });
      return;
    }
    const items = events(ctx)
      .values()
      .filter(
        (e) => e.userPoolId === UserPoolId && e.username === user.username
      );
    res.json({
      AuthEvents: (MaxResults ? items.slice(0, MaxResults) : items).map(
        (e) => ({
          EventId: e.eventId,
          EventType: e.eventType,
          CreationDate: e.creationDate,
          EventResponse: e.eventResponse,
          EventRisk: e.eventRisk && {
            RiskDecision: e.eventRisk.riskDecision,
            RiskLevel: e.eventRisk.riskLevel,
          },
          EventFeedback: e.eventFeedback && {
            FeedbackValue: e.eventFeedback.feedbackValue,
            Provider: e.eventFeedback.provider,
            FeedbackDate: e.eventFeedback.feedbackDate,
          },
        })
      ),
    });
  };
}

export function updateAuthEventFeedbackHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { EventId, FeedbackValue } = req.body;
    if (!EventId) {
      throw new InvalidParameterError("EventId is required.");
    }
    const existing = events(ctx).get(EventId);
    if (existing) {
      events(ctx).set(EventId, {
        ...existing,
        eventFeedback: {
          feedbackValue: FeedbackValue,
          provider: "cognito-local",
          feedbackDate: ctx.clock.now().toISOString(),
        },
      });
    }
    res.json({});
  };
}

// Both AdminUpdateAuthEventFeedback and UpdateAuthEventFeedback share logic
export function adminUpdateAuthEventFeedbackHandler(ctx: AppContext) {
  return updateAuthEventFeedbackHandler(ctx);
}
