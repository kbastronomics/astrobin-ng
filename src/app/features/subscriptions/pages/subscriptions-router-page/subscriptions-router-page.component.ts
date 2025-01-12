import { Component, OnInit } from "@angular/core";
import { AuthService } from "@shared/services/auth.service";
import { Location } from "@angular/common";
import { BaseComponentDirective } from "@shared/components/base-component.directive";
import { Store } from "@ngrx/store";
import { State } from "@app/store/state";

@Component({
  selector: "astrobin-subscriptions-router-page",
  templateUrl: "./subscriptions-router-page.component.html",
  styleUrls: ["./subscriptions-router-page.component.scss"]
})
export class SubscriptionsRouterPageComponent extends BaseComponentDirective implements OnInit {
  active: string;

  constructor(
    public readonly store$: Store<State>,
    public readonly authService: AuthService,
    public readonly location: Location
  ) {
    super(store$);
  }

  ngOnInit(): void {
    super.ngOnInit();

    const path = this.location.path();

    if (path === "/subscriptions/options") {
      this.active = "options";
    } else if (path === "/subscriptions/view") {
      this.active = "view";
    } else if (path === "/subscriptions/payments") {
      this.active = "payments";
    } else if (path === "/subscriptions/lite") {
      this.active = "lite";
    } else if (path === "/subscriptions/premium") {
      this.active = "premium";
    } else if (path === "/subscriptions/ultimate") {
      this.active = "ultimate";
    }
  }
}
