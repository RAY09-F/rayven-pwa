# Phone Home Screen layout — September 12, 2026

Production: c84d1772-95ac-4bfa-8ff0-01dcdbd1875c. Rollback: 5745b8b0-2d74-4131-b934-f2582c108bb8.
Phone-only CSS applies below 601px: full-width humanoid, large controls, reflowed panels, safe-area spacing and 16px text entry. Desktop geometry at 1440x1000 matched the prior layout exactly. Phone layouts at 320, 375, 390 and 430 pixels passed overflow, spacing, touch-target and persona-switch checks. 135 unit tests passed. Safari home-screen metadata, a standalone manifest and two app icons added; no offline functionality is claimed. Native iPhone Safari hardware testing remains unperformed.

Open the normal ASGARD URL in Safari, choose Share, Add to Home Screen, enable Open as Web App when offered, then Add.

RGB recovery during this work: found the local helper stopped and SignalRGB using Screen Ambience. Restarted the helper hidden, paired the in-app ASGARD browser, switched to Loki and verified SignalRGB selected ASGARD loki.html. MaxsunSync2 and its service were still running; Windows denied stopping them and the UI launch timed out. Physical fan output remains awaiting user confirmation; do not report it fixed solely from effect readback.
