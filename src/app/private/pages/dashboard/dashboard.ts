import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface DashboardService {
  title: string;
  description: string;
  route: string;
  ctaLabel: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  readonly services: DashboardService[] = [
    {
      title: 'Team Chat',
      description: 'Szybka komunikacja zespolowa i rozmowy prywatne.',
      route: '/app/chat',
      ctaLabel: 'Przejdz do chatu',
    },
    {
      title: 'Dokumenty',
      description: 'Tworzenie, edycja i zapisywanie dokumentow zespolu.',
      route: '/app/documents',
      ctaLabel: 'Przejdz do dokumentow',
    },
    {
      title: 'Team Meetings',
      description: 'Wideospotkania online i wspolna praca na zywo.',
      route: '/app/meetings',
      ctaLabel: 'Przejdz do spotkan',
    },
  ];
}
