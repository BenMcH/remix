import type { Location } from "history";
import type { Params } from "react-router";
import type { AppData, RouteData, EntryRouteObject } from "@remix-run/core";

export type { AppData, RouteData };

export type FormEncType =
  | "application/x-www-form-urlencoded"
  | "multipart/form-data";

export type FormMethod = "get" | "post" | "put" | "patch" | "delete";

export interface FormSubmit {
  method: FormMethod;
  data: FormData;
  encType: FormEncType;
}

export interface DataRedirectHandler {
  (url: URL): void;
}

/**
 * Loads the global data from the server.
 */
export function loadGlobalData(
  loaderUrl: string | undefined,
  location: Location,
  handleRedirect: DataRedirectHandler
) {
  return fetchData(loaderUrl, location, "_global", {}, handleRedirect);
}

/**
 * Loads some data for a route from the server.
 */
export function loadRouteData(
  route: EntryRouteObject,
  location: Location,
  routeParams: Params,
  handleRedirect: DataRedirectHandler,
  formSubmit?: FormSubmit
): Promise<AppData> {
  return fetchData(
    route.loaderUrl,
    location,
    route.id,
    routeParams,
    handleRedirect,
    formSubmit
  );
}

async function fetchData(
  loaderUrl: string | undefined,
  location: Location,
  routeId: string,
  routeParams: Params,
  handleRedirect: DataRedirectHandler,
  formSubmit?: FormSubmit
): Promise<AppData> {
  if (!loaderUrl) return undefined;

  let origin = window.location.origin;
  let url = new URL(location.pathname + location.search, origin);
  let params = new URLSearchParams({
    params: JSON.stringify(routeParams),
    url: url.toString(),
    id: routeId
  });

  let init = formSubmit ? getFormSubmitInit(formSubmit) : undefined;
  let response = await fetch(`${loaderUrl}?${params.toString()}`, init);

  let redirectUrl = response.headers.get("X-Remix-Redirect");
  if (redirectUrl) {
    handleRedirect(new URL(redirectUrl, window.location.origin));
  }

  // We discussed possibly reloading here to get the right status code from the
  // server for the HTML page when the data loader returns a 404, but ultimately
  // concluded it's probably better to just not have any JavaScript on the page
  // when search bots come around to index things.

  return extractData(response);
}

function extractData(response: Response): Promise<AppData> {
  // This same algorithm is used on the server to interpret load
  // results when we render the HTML page.
  let contentType = response.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return response.json();
  }

  return response.text();
}

function getFormSubmitInit(formSubmit: FormSubmit): RequestInit {
  let body =
    formSubmit.encType === "application/x-www-form-urlencoded"
      ? // TODO: Patch the URLSearchParams constructor type to accept FormData
        // @ts-ignore
        new URLSearchParams(formSubmit.data)
      : formSubmit.data;

  return {
    method: formSubmit.method,
    body,
    headers: {
      "Content-Type": formSubmit.encType
    }
  };
}