import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from "@angular/router";
import { State } from "@app/store/state";
import { Store } from "@ngrx/store";
import { BaseService } from "@shared/services/base.service";
import { LoadingService } from "@shared/services/loading.service";
import { UserSubscriptionService } from "@shared/services/user-subscription/user-subscription.service";
import { SubscriptionName } from "@shared/types/subscription-name.type";
import { Observable } from "rxjs";
import { switchMap, take } from "rxjs/operators";

@Injectable()
export class UltimateSubscriptionGuardService extends BaseService implements CanActivate {
  constructor(
    public readonly store$: Store<State>,
    public readonly loadingService: LoadingService,
    public readonly userSubscriptionService: UserSubscriptionService,
    public readonly router: Router
  ) {
    super(loadingService);
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot, redirect = true): Observable<boolean> {
    return new Observable<boolean>(observer => {
      this.store$
        .pipe(
          take(1),
          switchMap(storeState =>
            this.userSubscriptionService.hasValidSubscription$(storeState.auth.userProfile, [
              SubscriptionName.ASTROBIN_ULTIMATE_2020
            ])
          )
        )
        .subscribe(hasValidUltimate => {
          if (hasValidUltimate) {
            observer.next(true);
            observer.complete();
            return;
          }

          if (redirect) {
            this.router.navigateByUrl(this.router.createUrlTree(["/permission-denied"])).then(() => {
              observer.next(false);
              observer.complete();
            });
          } else {
            observer.next(false);
            observer.complete();
          }
        });
    });
  }
}
