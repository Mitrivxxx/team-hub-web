import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-service-placeholder',
  imports: [RouterLink],
  templateUrl: './service-placeholder.html',
  styleUrl: './service-placeholder.scss',
})
export class ServicePlaceholder {
  private readonly route = inject(ActivatedRoute);

  readonly title = this.route.snapshot.data['title'] as string;
  readonly description = this.route.snapshot.data['description'] as string;
}
